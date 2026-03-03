import { UnauthorizedException } from "@nestjs/common";
import { OrderStatus } from "@prisma/client";
import { PaymentAttemptStatus, Prisma } from "@prisma/client";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../common/prisma/prisma.service";
import { WebhooksService } from "./webhooks.service";

type PrismaServiceMock = {
  webhookProcessedEvent: {
    findUnique: jest.Mock;
  };
  $transaction: jest.Mock;
};

describe("WebhooksService", () => {
  let service: WebhooksService;
  let prismaMock: PrismaServiceMock;
  let configService: ConfigService;

  beforeEach(() => {
    prismaMock = {
      webhookProcessedEvent: {
        findUnique: jest.fn()
      },
      $transaction: jest.fn()
    };
    configService = new ConfigService({
      WEBHOOK_SIGNATURE_SECRET: "secret"
    });
    service = new WebhooksService(
      prismaMock as unknown as PrismaService,
      configService
    );
  });

  it("rejects invalid signature", () => {
    expect(() => {
      service.verifySignature("{}", "invalid");
    }).toThrow(UnauthorizedException);
  });

  it("returns duplicate when event already processed", async () => {
    prismaMock.webhookProcessedEvent.findUnique.mockResolvedValue({
      id: "w1",
      eventId: "evt-1"
    });

    const result = await service.processPaymentEvent("evt-1", {
      id: "evt-1",
      type: "payment.succeeded",
      occurredAt: new Date().toISOString(),
      data: { paymentAttemptId: "pay-1", orderId: "ord-1" }
    });

    expect(result.status).toBe("duplicate");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("marks payment as success and order as paid", async () => {
    prismaMock.webhookProcessedEvent.findUnique.mockResolvedValue(null);

    const tx = {
      webhookProcessedEvent: { create: jest.fn().mockResolvedValue(null) },
      paymentAttempt: {
        findUnique: jest.fn().mockResolvedValue({
          id: "pay-1",
          orderId: "ord-1"
        }),
        update: jest.fn().mockResolvedValue({
          status: PaymentAttemptStatus.SUCCESS
        })
      },
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: "ord-1",
          status: OrderStatus.PENDING_PAYMENT
        }),
        update: jest.fn().mockResolvedValue({ status: "PAID" })
      },
      orderItem: { findMany: jest.fn() },
      inventory: { findUnique: jest.fn(), update: jest.fn() }
    };

    prismaMock.$transaction.mockImplementation(
      async (
        callback: (client: Prisma.TransactionClient) => Promise<unknown>
      ) => callback(tx as unknown as Prisma.TransactionClient)
    );

    const result = await service.processPaymentEvent("evt-2", {
      id: "evt-2",
      type: "payment.succeeded",
      occurredAt: new Date().toISOString(),
      data: { paymentAttemptId: "pay-1", orderId: "ord-1" }
    });

    expect(result.status).toBe("processed");
    expect(tx.paymentAttempt.update).toHaveBeenCalled();
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: "ord-1" },
      data: { status: "PAID" }
    });
  });

  it("marks payment failed and releases reserved stock", async () => {
    prismaMock.webhookProcessedEvent.findUnique.mockResolvedValue(null);

    const tx = {
      webhookProcessedEvent: { create: jest.fn().mockResolvedValue(null) },
      paymentAttempt: {
        findUnique: jest.fn().mockResolvedValue({
          id: "pay-2",
          orderId: "ord-2"
        }),
        update: jest.fn().mockResolvedValue({
          status: PaymentAttemptStatus.FAILED
        })
      },
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: "ord-2",
          status: OrderStatus.PENDING_PAYMENT
        }),
        update: jest.fn().mockResolvedValue({ status: "PAYMENT_FAILED" })
      },
      orderItem: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ productId: "p1", quantity: 2 }])
      },
      inventory: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: "inv1", productId: "p1", reserved: 5 }),
        update: jest.fn().mockResolvedValue(null)
      }
    };

    prismaMock.$transaction.mockImplementation(
      async (
        callback: (client: Prisma.TransactionClient) => Promise<unknown>
      ) => callback(tx as unknown as Prisma.TransactionClient)
    );

    const result = await service.processPaymentEvent("evt-3", {
      id: "evt-3",
      type: "payment.failed",
      occurredAt: new Date().toISOString(),
      data: { paymentAttemptId: "pay-2", orderId: "ord-2" }
    });

    expect(result.status).toBe("processed");
    expect(tx.inventory.update).toHaveBeenCalledWith({
      where: { id: "inv1" },
      data: { reserved: 3 }
    });
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: "ord-2" },
      data: { status: OrderStatus.PAYMENT_FAILED }
    });
  });
});
