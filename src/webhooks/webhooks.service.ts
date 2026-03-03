import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OrderStatus, PaymentAttemptStatus, Prisma } from "@prisma/client";
import { createHmac, timingSafeEqual } from "node:crypto";
import { PrismaService } from "../common/prisma/prisma.service";
import { PaymentWebhookDto } from "./dto/payment-webhook.dto";

export interface WebhookProcessResult {
  status: "processed" | "duplicate";
}

@Injectable()
export class WebhooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  verifySignature(payload: string, signature: string): void {
    const secret = this.configService.get<string>("WEBHOOK_SIGNATURE_SECRET");
    if (!secret) {
      throw new Error("WEBHOOK_SIGNATURE_SECRET must be configured.");
    }

    const expectedSignature = createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    const expectedBuffer = Buffer.from(expectedSignature, "utf8");
    const incomingBuffer = Buffer.from(signature, "utf8");
    if (expectedBuffer.length !== incomingBuffer.length) {
      throw new UnauthorizedException("Invalid webhook signature.");
    }
    if (!timingSafeEqual(expectedBuffer, incomingBuffer)) {
      throw new UnauthorizedException("Invalid webhook signature.");
    }
  }

  async processPaymentEvent(
    eventId: string,
    payload: PaymentWebhookDto
  ): Promise<WebhookProcessResult> {
    const existingEvent = await this.prisma.webhookProcessedEvent.findUnique({
      where: { eventId }
    });
    if (existingEvent) {
      return { status: "duplicate" };
    }

    try {
      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.webhookProcessedEvent.create({
          data: {
            eventId,
            eventType: payload.type,
            payload: payload as unknown as Prisma.InputJsonValue
          }
        });

        const paymentAttempt = await tx.paymentAttempt.findUnique({
          where: { id: payload.data.paymentAttemptId }
        });
        if (!paymentAttempt || paymentAttempt.orderId !== payload.data.orderId) {
          throw new BadRequestException("Payment attempt/order mismatch.");
        }
        const order = await tx.order.findUnique({
          where: { id: paymentAttempt.orderId }
        });
        if (!order) {
          throw new BadRequestException("Order not found for payment attempt.");
        }

        if (payload.type === "payment.succeeded") {
          if (
            order.status !== OrderStatus.PENDING_PAYMENT &&
            order.status !== OrderStatus.PAID
          ) {
            throw new ConflictException(
              `Invalid order transition for success event. current=${order.status}`
            );
          }
          await tx.paymentAttempt.update({
            where: { id: paymentAttempt.id },
            data: { status: PaymentAttemptStatus.SUCCESS, failureReason: null }
          });
          if (order.status === OrderStatus.PENDING_PAYMENT) {
            await tx.order.update({
              where: { id: paymentAttempt.orderId },
              data: { status: OrderStatus.PAID }
            });
          }
          return;
        }

        if (
          order.status !== OrderStatus.PENDING_PAYMENT &&
          order.status !== OrderStatus.PAYMENT_FAILED
        ) {
          throw new ConflictException(
            `Invalid order transition for fail event. current=${order.status}`
          );
        }

        await tx.paymentAttempt.update({
          where: { id: paymentAttempt.id },
          data: {
            status: PaymentAttemptStatus.FAILED,
            failureReason: "Simulation failure"
          }
        });

        if (order.status === OrderStatus.PENDING_PAYMENT) {
          const orderItems = await tx.orderItem.findMany({
            where: { orderId: paymentAttempt.orderId }
          });
          for (const item of orderItems) {
            const inventory = await tx.inventory.findUnique({
              where: { productId: item.productId }
            });
            if (!inventory) {
              continue;
            }
            const nextReserved = Math.max(0, inventory.reserved - item.quantity);
            await tx.inventory.update({
              where: { id: inventory.id },
              data: { reserved: nextReserved }
            });
          }
          await tx.order.update({
            where: { id: paymentAttempt.orderId },
            data: { status: OrderStatus.PAYMENT_FAILED }
          });
        }
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return { status: "duplicate" };
      }
      throw error;
    }

    return { status: "processed" };
  }
}
