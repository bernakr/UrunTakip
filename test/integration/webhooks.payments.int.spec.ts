import { OrderStatus, PaymentAttemptStatus } from "@prisma/client";
import { createHmac, randomUUID } from "node:crypto";
import request from "supertest";
import {
  closeIntegrationContext,
  createIntegrationContext,
  IntegrationContext
} from "./bootstrap";
import {
  createOrderWithPaymentAttempt,
  findInventoryReserved,
  resetDatabase
} from "./db";

interface WebhookPayload {
  id: string;
  type: "payment.succeeded" | "payment.failed";
  occurredAt: string;
  data: {
    paymentAttemptId: string;
    orderId: string;
  };
}

function signWebhookPayload(payload: WebhookPayload): string {
  const secret = process.env.WEBHOOK_SIGNATURE_SECRET;
  if (!secret) {
    throw new Error("WEBHOOK_SIGNATURE_SECRET must be set for integration tests.");
  }
  return createHmac("sha256", secret)
    .update(JSON.stringify(payload))
    .digest("hex");
}

describe("Payment webhook integration", () => {
  let context: IntegrationContext;

  beforeAll(async () => {
    context = await createIntegrationContext();
  });

  beforeEach(async () => {
    await resetDatabase(context.prisma);
  });

  afterAll(async () => {
    await closeIntegrationContext(context);
  });

  it("rejects invalid signature with 401", async () => {
    const fixture = await createOrderWithPaymentAttempt(context.prisma);
    const payload: WebhookPayload = {
      id: `evt-${randomUUID()}`,
      type: "payment.succeeded",
      occurredAt: new Date().toISOString(),
      data: {
        paymentAttemptId: fixture.paymentAttemptId,
        orderId: fixture.orderId
      }
    };

    const response = await request(context.app.getHttpServer())
      .post("/api/webhooks/payments")
      .set("x-event-id", payload.id)
      .set("x-signature", "invalid-signature")
      .send(payload);

    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe("Invalid webhook signature.");
  });

  it("returns duplicate for repeated event id and keeps single processed event row", async () => {
    const fixture = await createOrderWithPaymentAttempt(context.prisma);
    const eventId = `evt-${randomUUID()}`;
    const payload: WebhookPayload = {
      id: eventId,
      type: "payment.succeeded",
      occurredAt: new Date().toISOString(),
      data: {
        paymentAttemptId: fixture.paymentAttemptId,
        orderId: fixture.orderId
      }
    };
    const signature = signWebhookPayload(payload);

    await request(context.app.getHttpServer())
      .post("/api/webhooks/payments")
      .set("x-event-id", eventId)
      .set("x-signature", signature)
      .send(payload)
      .expect(201);

    const duplicateResponse = await request(context.app.getHttpServer())
      .post("/api/webhooks/payments")
      .set("x-event-id", eventId)
      .set("x-signature", signature)
      .send(payload);

    expect(duplicateResponse.status).toBe(201);
    expect(duplicateResponse.body.status).toBe("duplicate");

    const processedEventCount = await context.prisma.webhookProcessedEvent.count({
      where: { eventId }
    });
    expect(processedEventCount).toBe(1);
  });

  it("marks payment attempt SUCCESS and order PAID on payment.succeeded", async () => {
    const fixture = await createOrderWithPaymentAttempt(context.prisma);
    const payload: WebhookPayload = {
      id: `evt-${randomUUID()}`,
      type: "payment.succeeded",
      occurredAt: new Date().toISOString(),
      data: {
        paymentAttemptId: fixture.paymentAttemptId,
        orderId: fixture.orderId
      }
    };
    const signature = signWebhookPayload(payload);

    const response = await request(context.app.getHttpServer())
      .post("/api/webhooks/payments")
      .set("x-event-id", payload.id)
      .set("x-signature", signature)
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.status).toBe("processed");

    const attempt = await context.prisma.paymentAttempt.findUnique({
      where: { id: fixture.paymentAttemptId }
    });
    const order = await context.prisma.order.findUnique({
      where: { id: fixture.orderId }
    });

    expect(attempt?.status).toBe(PaymentAttemptStatus.SUCCESS);
    expect(order?.status).toBe(OrderStatus.PAID);
  });

  it("marks payment attempt FAILED, order PAYMENT_FAILED and releases reserved stock", async () => {
    const fixture = await createOrderWithPaymentAttempt(context.prisma, {
      inventoryOnHand: 10,
      inventoryReserved: 5,
      quantity: 2
    });
    const payload: WebhookPayload = {
      id: `evt-${randomUUID()}`,
      type: "payment.failed",
      occurredAt: new Date().toISOString(),
      data: {
        paymentAttemptId: fixture.paymentAttemptId,
        orderId: fixture.orderId
      }
    };
    const signature = signWebhookPayload(payload);

    const response = await request(context.app.getHttpServer())
      .post("/api/webhooks/payments")
      .set("x-event-id", payload.id)
      .set("x-signature", signature)
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.status).toBe("processed");

    const attempt = await context.prisma.paymentAttempt.findUnique({
      where: { id: fixture.paymentAttemptId }
    });
    const order = await context.prisma.order.findUnique({
      where: { id: fixture.orderId }
    });
    const reserved = await findInventoryReserved(context.prisma, fixture.productId);

    expect(attempt?.status).toBe(PaymentAttemptStatus.FAILED);
    expect(order?.status).toBe(OrderStatus.PAYMENT_FAILED);
    expect(reserved).toBe(3);
  });
});
