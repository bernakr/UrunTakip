import {
  OrderStatus,
  PaymentAttemptStatus,
  Prisma,
  PrismaClient
} from "@prisma/client";
import { randomUUID } from "node:crypto";

type PrismaLike = PrismaClient;

export interface ProductInventoryFixture {
  productId: string;
  inventoryId: string;
  price: number;
}

export interface OrderWithAttemptFixture {
  userId: string;
  orderId: string;
  paymentAttemptId: string;
  productId: string;
  inventoryId: string;
}

interface CreateOrderWithAttemptOptions {
  orderStatus?: OrderStatus;
  paymentAttemptStatus?: PaymentAttemptStatus;
  inventoryOnHand?: number;
  inventoryReserved?: number;
  quantity?: number;
  unitPrice?: number;
}

export async function resetDatabase(prisma: PrismaLike): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "WebhookProcessedEvent",
      "RefundRequest",
      "PaymentAttempt",
      "OrderItem",
      "Order",
      "CartItem",
      "Cart",
      "Inventory",
      "Product",
      "User"
    RESTART IDENTITY CASCADE
  `);
}

export async function createCustomerUser(
  prisma: PrismaLike
): Promise<{ id: string; email: string }> {
  const created = await prisma.user.create({
    data: {
      email: `customer-${randomUUID()}@example.com`,
      passwordHash: "not-used-in-integration-tests",
      role: "CUSTOMER"
    }
  });

  return { id: created.id, email: created.email };
}

export async function createProductWithInventory(
  prisma: PrismaLike,
  input?: {
    price?: number;
    onHand?: number;
    reserved?: number;
    name?: string;
  }
): Promise<ProductInventoryFixture> {
  const price = input?.price ?? 1000;
  const onHand = input?.onHand ?? 10;
  const reserved = input?.reserved ?? 0;
  const name = input?.name ?? `Product ${randomUUID().slice(0, 8)}`;

  const created = await prisma.product.create({
    data: {
      sku: `SKU-${randomUUID().slice(0, 8)}`,
      name,
      price,
      inventory: {
        create: {
          onHand,
          reserved
        }
      }
    },
    include: { inventory: true }
  });

  return {
    productId: created.id,
    inventoryId: created.inventory!.id,
    price
  };
}

export async function createOrderForUser(
  prisma: PrismaLike,
  params: {
    userId: string;
    status: OrderStatus;
    totalAmount: number;
  }
): Promise<{ orderId: string }> {
  const created = await prisma.order.create({
    data: {
      userId: params.userId,
      status: params.status,
      totalAmount: params.totalAmount
    }
  });
  return { orderId: created.id };
}

export async function createOrderWithPaymentAttempt(
  prisma: PrismaLike,
  options?: CreateOrderWithAttemptOptions
): Promise<OrderWithAttemptFixture> {
  const user = await createCustomerUser(prisma);
  const product = await createProductWithInventory(prisma, {
    price: options?.unitPrice ?? 1000,
    onHand: options?.inventoryOnHand ?? 10,
    reserved: options?.inventoryReserved ?? 0
  });
  const quantity = options?.quantity ?? 1;
  const orderStatus = options?.orderStatus ?? OrderStatus.PENDING_PAYMENT;
  const paymentAttemptStatus =
    options?.paymentAttemptStatus ?? PaymentAttemptStatus.PENDING;

  const order = await prisma.order.create({
    data: {
      userId: user.id,
      status: orderStatus,
      totalAmount: product.price * quantity,
      items: {
        create: {
          productId: product.productId,
          quantity,
          unitPrice: product.price
        }
      }
    }
  });

  const attempt = await prisma.paymentAttempt.create({
    data: {
      orderId: order.id,
      idempotencyKey: `idem-${randomUUID()}`,
      status: paymentAttemptStatus
    }
  });

  return {
    userId: user.id,
    orderId: order.id,
    paymentAttemptId: attempt.id,
    productId: product.productId,
    inventoryId: product.inventoryId
  };
}

export async function countRefundRequestsByOrderAndIdempotency(
  prisma: PrismaLike,
  orderId: string,
  idempotencyKey: string
): Promise<number> {
  return prisma.refundRequest.count({
    where: {
      orderId,
      idempotencyKey
    }
  });
}

export async function findInventoryReserved(
  prisma: PrismaLike,
  productId: string
): Promise<number> {
  const inventory = await prisma.inventory.findUnique({ where: { productId } });
  if (!inventory) {
    throw new Error(`inventory missing for product ${productId}`);
  }
  return inventory.reserved;
}

export async function createCustomerThroughPrisma(
  prisma: PrismaLike
): Promise<{ id: string; email: string }> {
  return createCustomerUser(prisma);
}

export async function withTransaction(
  prisma: PrismaLike,
  callback: (tx: Prisma.TransactionClient) => Promise<void>
): Promise<void> {
  await prisma.$transaction(async (tx) => callback(tx));
}
