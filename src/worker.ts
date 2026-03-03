import "dotenv/config";
import { Logger } from "@nestjs/common";
import { OrderStatus, PrismaClient, RefundStatus } from "@prisma/client";
import { Job, Worker } from "bullmq";
import { createHmac, randomUUID } from "node:crypto";
import { QUEUES } from "./queue/queue.constants";
import type { PaymentJobData, RefundJobData } from "./queue/queue.service";

const logger = new Logger("Worker");

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function buildRedisConnection(): { host: string; port: number; password?: string } {
  const host = process.env.REDIS_HOST ?? "localhost";
  const port = Number(process.env.REDIS_PORT ?? "6379");
  const password = process.env.REDIS_PASSWORD || undefined;
  return {
    host,
    port,
    password
  };
}

function signPayload(payload: string): string {
  const secret = process.env.WEBHOOK_SIGNATURE_SECRET;
  if (!secret) {
    throw new Error("WEBHOOK_SIGNATURE_SECRET must be configured.");
  }
  return createHmac("sha256", secret).update(payload).digest("hex");
}

async function processPaymentJob(
  prisma: PrismaClient,
  job: Job<PaymentJobData>
): Promise<void> {
  const attempt = await prisma.paymentAttempt.findUnique({
    where: { id: job.data.paymentAttemptId }
  });
  if (!attempt || attempt.status !== "PENDING") {
    return;
  }

  await sleep(2000);
  const isSuccess = Math.random() < 0.7;
  const eventId = randomUUID();
  const event = {
    id: eventId,
    type: isSuccess ? "payment.succeeded" : "payment.failed",
    occurredAt: new Date().toISOString(),
    data: {
      paymentAttemptId: job.data.paymentAttemptId,
      orderId: job.data.orderId
    }
  };

  const payload = JSON.stringify(event);
  const signature = signPayload(payload);
  const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:3000";

  const response = await fetch(`${apiBaseUrl}/api/webhooks/payments`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-signature": signature,
      "x-event-id": eventId
    },
    body: payload
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Payment webhook failed: ${response.status} ${message}`);
  }
}

async function processRefundJob(
  prisma: PrismaClient,
  job: Job<RefundJobData>
): Promise<void> {
  const refund = await prisma.refundRequest.findUnique({
    where: { id: job.data.refundRequestId }
  });
  if (!refund || refund.status !== RefundStatus.REQUESTED) {
    return;
  }

  await prisma.refundRequest.update({
    where: { id: refund.id },
    data: { status: RefundStatus.PROCESSING }
  });

  await sleep(2000);
  const success = Math.random() < 0.9;

  await prisma.$transaction(async (tx) => {
    if (success) {
      const updatedOrder = await tx.order.updateMany({
        where: { id: refund.orderId, status: OrderStatus.PAID },
        data: { status: OrderStatus.REFUNDED }
      });
      if (updatedOrder.count === 0) {
        await tx.refundRequest.update({
          where: { id: refund.id },
          data: {
            status: RefundStatus.FAILED,
            failureReason: "Order is not in PAID state."
          }
        });
        return;
      }
      await tx.refundRequest.update({
        where: { id: refund.id },
        data: { status: RefundStatus.SUCCEEDED, failureReason: null }
      });
      return;
    }

    await tx.refundRequest.update({
      where: { id: refund.id },
      data: {
        status: RefundStatus.FAILED,
        failureReason: "Refund simulation failed."
      }
    });
  });
}

async function bootstrapWorker(): Promise<void> {
  const redisConnection = buildRedisConnection();
  const prisma = new PrismaClient();

  const paymentWorker = new Worker<PaymentJobData>(
    QUEUES.PAYMENT,
    async (job) => processPaymentJob(prisma, job),
    { connection: redisConnection }
  );

  const refundWorker = new Worker<RefundJobData>(
    QUEUES.REFUND,
    async (job) => processRefundJob(prisma, job),
    { connection: redisConnection }
  );

  paymentWorker.on("completed", (job) => {
    logger.log(`Payment job completed: ${job.id}`);
  });
  paymentWorker.on("failed", (job, error) => {
    logger.error(`Payment job failed: ${job?.id}`, error.stack);
  });
  refundWorker.on("completed", (job) => {
    logger.log(`Refund job completed: ${job.id}`);
  });
  refundWorker.on("failed", (job, error) => {
    logger.error(`Refund job failed: ${job?.id}`, error.stack);
  });

  logger.log("Workers are running.");

  const shutdown = async (): Promise<void> => {
    logger.log("Shutting down workers...");
    await paymentWorker.close();
    await refundWorker.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown();
  });
  process.on("SIGTERM", () => {
    void shutdown();
  });
}

void bootstrapWorker();
