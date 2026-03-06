import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { OrderStatus, Prisma, RefundStatus } from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";

export interface OrderItemView {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface OrderView {
  id: string;
  userId: string;
  status: OrderStatus;
  totalAmount: number;
  createdAt: Date;
  updatedAt: Date;
  items: OrderItemView[];
}

export interface OrderTimelineEventView {
  type:
    | "ORDER_CREATED"
    | "PAYMENT_ATTEMPT_CREATED"
    | "PAYMENT_SUCCEEDED"
    | "PAYMENT_FAILED"
    | "ORDER_CANCELLED"
    | "REFUND_REQUESTED"
    | "REFUND_PROCESSING"
    | "REFUND_SUCCEEDED"
    | "REFUND_FAILED";
  status: string;
  occurredAt: Date;
  detail: string | null;
}

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async checkout(userId: string): Promise<OrderView> {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const cart = await tx.cart.findUnique({
        where: { userId },
        include: {
          items: {
            include: { product: true }
          }
        }
      });

      if (!cart || cart.items.length === 0) {
        throw new BadRequestException("Cart is empty.");
      }

      const sortedProductIds = Array.from(
        new Set(cart.items.map((item) => item.productId))
      ).sort();

      for (const productId of sortedProductIds) {
        await tx.$queryRaw`
          SELECT id
          FROM "Inventory"
          WHERE "productId" = ${productId}
          FOR UPDATE
        `;
      }

      const inventories = await tx.inventory.findMany({
        where: { productId: { in: sortedProductIds } }
      });

      const inventoryByProductId = new Map(
        inventories.map((inventory) => [inventory.productId, inventory])
      );

      for (const item of cart.items) {
        const inventory = inventoryByProductId.get(item.productId);
        if (!inventory) {
          throw new NotFoundException(
            `Inventory not found for product ${item.productId}.`
          );
        }
        const available = inventory.onHand - inventory.reserved;
        if (available < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for product ${item.product.name}.`
          );
        }
      }

      for (const item of cart.items) {
        await tx.inventory.update({
          where: { productId: item.productId },
          data: { reserved: { increment: item.quantity } }
        });
      }

      const totalAmount = cart.items.reduce(
        (sum, item) => sum + item.product.price * item.quantity,
        0
      );

      const order = await tx.order.create({
        data: {
          userId,
          status: OrderStatus.PENDING_PAYMENT,
          totalAmount,
          items: {
            createMany: {
              data: cart.items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.product.price
              }))
            }
          }
        },
        include: {
          items: true
        }
      });

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return mapOrder(order);
    });
  }

  async listByUser(userId: string): Promise<OrderView[]> {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      include: { items: true },
      orderBy: { createdAt: "desc" }
    });

    return orders.map(mapOrder);
  }

  async getByIdForUser(userId: string, orderId: string): Promise<OrderView> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { items: true }
    });
    if (!order) {
      throw new NotFoundException("Order not found.");
    }

    return mapOrder(order);
  }

  async cancelForUser(userId: string, orderId: string): Promise<OrderView> {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, userId },
        include: { items: true }
      });
      if (!order) {
        throw new NotFoundException("Order not found.");
      }
      if (order.status === OrderStatus.CANCELLED) {
        throw new BadRequestException("Order is already cancelled.");
      }
      if (order.status === OrderStatus.PAID || order.status === OrderStatus.REFUNDED) {
        throw new BadRequestException("Paid or refunded orders cannot be cancelled.");
      }

      if (order.status === OrderStatus.PENDING_PAYMENT) {
        for (const item of order.items) {
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
      }

      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.CANCELLED },
        include: { items: true }
      });

      return mapOrder(updatedOrder);
    });
  }

  async getTimelineForUser(
    userId: string,
    orderId: string
  ): Promise<OrderTimelineEventView[]> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: {
        paymentAttempts: {
          orderBy: { createdAt: "asc" }
        },
        refundRequests: {
          orderBy: { createdAt: "asc" }
        }
      }
    });

    if (!order) {
      throw new NotFoundException("Order not found.");
    }

    const timeline: OrderTimelineEventView[] = [
      {
        type: "ORDER_CREATED",
        status: OrderStatus.PENDING_PAYMENT,
        occurredAt: order.createdAt,
        detail: null
      }
    ];

    for (const attempt of order.paymentAttempts) {
      timeline.push({
        type: "PAYMENT_ATTEMPT_CREATED",
        status: attempt.status,
        occurredAt: attempt.createdAt,
        detail: null
      });

      if (attempt.status === "SUCCESS") {
        timeline.push({
          type: "PAYMENT_SUCCEEDED",
          status: attempt.status,
          occurredAt: attempt.updatedAt,
          detail: null
        });
      } else if (attempt.status === "FAILED") {
        timeline.push({
          type: "PAYMENT_FAILED",
          status: attempt.status,
          occurredAt: attempt.updatedAt,
          detail: attempt.failureReason ?? null
        });
      }
    }

    if (order.status === OrderStatus.CANCELLED) {
      timeline.push({
        type: "ORDER_CANCELLED",
        status: order.status,
        occurredAt: order.updatedAt,
        detail: null
      });
    }

    for (const refund of order.refundRequests) {
      timeline.push({
        type: "REFUND_REQUESTED",
        status: refund.status,
        occurredAt: refund.createdAt,
        detail: refund.reason ?? null
      });

      if (refund.status === RefundStatus.PROCESSING) {
        timeline.push({
          type: "REFUND_PROCESSING",
          status: refund.status,
          occurredAt: refund.updatedAt,
          detail: null
        });
      }

      if (refund.status === RefundStatus.SUCCEEDED) {
        timeline.push({
          type: "REFUND_SUCCEEDED",
          status: refund.status,
          occurredAt: refund.updatedAt,
          detail: null
        });
      }

      if (refund.status === RefundStatus.FAILED) {
        timeline.push({
          type: "REFUND_FAILED",
          status: refund.status,
          occurredAt: refund.updatedAt,
          detail: refund.failureReason ?? null
        });
      }
    }

    timeline.sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime());

    return timeline;
  }
}

function mapOrder(order: {
  id: string;
  userId: string;
  status: OrderStatus;
  totalAmount: number;
  createdAt: Date;
  updatedAt: Date;
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
  }>;
}): OrderView {
  return {
    id: order.id,
    userId: order.userId,
    status: order.status,
    totalAmount: order.totalAmount,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    items: order.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice
    }))
  };
}
