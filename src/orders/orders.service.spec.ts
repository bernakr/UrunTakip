import { BadRequestException } from "@nestjs/common";
import { OrderStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";
import { OrdersService } from "./orders.service";

type TransactionMock = {
  cart: { findUnique: jest.Mock };
  $queryRaw: jest.Mock;
  inventory: { findMany: jest.Mock; update: jest.Mock };
  order: { create: jest.Mock };
  cartItem: { deleteMany: jest.Mock };
};

type PrismaServiceMock = {
  $transaction: jest.Mock;
  order: { findMany: jest.Mock; findFirst: jest.Mock };
};

describe("OrdersService", () => {
  let service: OrdersService;
  let prismaMock: PrismaServiceMock;

  beforeEach(() => {
    prismaMock = {
      $transaction: jest.fn(),
      order: {
        findMany: jest.fn(),
        findFirst: jest.fn()
      }
    };
    service = new OrdersService(prismaMock as unknown as PrismaService);
  });

  it("throws when cart is empty", async () => {
    const tx: TransactionMock = {
      cart: { findUnique: jest.fn().mockResolvedValue({ items: [] }) },
      $queryRaw: jest.fn(),
      inventory: { findMany: jest.fn(), update: jest.fn() },
      order: { create: jest.fn() },
      cartItem: { deleteMany: jest.fn() }
    };

    prismaMock.$transaction.mockImplementation(
      async (
        callback: (client: Prisma.TransactionClient) => Promise<unknown>
      ) => callback(tx as unknown as Prisma.TransactionClient)
    );

    await expect(service.checkout("u1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("throws when stock is insufficient", async () => {
    const tx: TransactionMock = {
      cart: {
        findUnique: jest.fn().mockResolvedValue({
          id: "cart1",
          items: [
            {
              productId: "p1",
              quantity: 5,
              product: { id: "p1", name: "Basic T-Shirt", price: 1000 }
            }
          ]
        })
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
      inventory: {
        findMany: jest.fn().mockResolvedValue([
          { productId: "p1", onHand: 5, reserved: 3 }
        ]),
        update: jest.fn()
      },
      order: { create: jest.fn() },
      cartItem: { deleteMany: jest.fn() }
    };

    prismaMock.$transaction.mockImplementation(
      async (
        callback: (client: Prisma.TransactionClient) => Promise<unknown>
      ) => callback(tx as unknown as Prisma.TransactionClient)
    );

    await expect(service.checkout("u1")).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it("reserves stock and creates order successfully", async () => {
    const tx: TransactionMock = {
      cart: {
        findUnique: jest.fn().mockResolvedValue({
          id: "cart1",
          items: [
            {
              productId: "p2",
              quantity: 1,
              product: { id: "p2", name: "Cap", price: 2000 }
            },
            {
              productId: "p1",
              quantity: 2,
              product: { id: "p1", name: "T-Shirt", price: 1000 }
            }
          ]
        })
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
      inventory: {
        findMany: jest.fn().mockResolvedValue([
          { productId: "p1", onHand: 10, reserved: 2 },
          { productId: "p2", onHand: 7, reserved: 1 }
        ]),
        update: jest.fn().mockResolvedValue(null)
      },
      order: {
        create: jest.fn().mockResolvedValue({
          id: "o1",
          userId: "u1",
          status: OrderStatus.PENDING_PAYMENT,
          totalAmount: 4000,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          items: [
            { productId: "p2", quantity: 1, unitPrice: 2000 },
            { productId: "p1", quantity: 2, unitPrice: 1000 }
          ]
        })
      },
      cartItem: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) }
    };

    prismaMock.$transaction.mockImplementation(
      async (
        callback: (client: Prisma.TransactionClient) => Promise<unknown>
      ) => callback(tx as unknown as Prisma.TransactionClient)
    );

    const result = await service.checkout("u1");

    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(tx.inventory.update).toHaveBeenCalledTimes(2);
    expect(tx.cartItem.deleteMany).toHaveBeenCalledWith({
      where: { cartId: "cart1" }
    });
    expect(result.totalAmount).toBe(4000);
  });
});

