import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { OrderStatus, Prisma } from "@prisma/client";
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
  items: OrderItemView[];
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

      return {
        id: order.id,
        userId: order.userId,
        status: order.status,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt,
        items: order.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice
        }))
      };
    });
  }

  async listByUser(userId: string): Promise<OrderView[]> {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      include: { items: true },
      orderBy: { createdAt: "desc" }
    });

    return orders.map((order) => ({
      id: order.id,
      userId: order.userId,
      status: order.status,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt,
      items: order.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice
      }))
    }));
  }

  async getByIdForUser(userId: string, orderId: string): Promise<OrderView> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { items: true }
    });
    if (!order) {
      throw new NotFoundException("Order not found.");
    }

    return {
      id: order.id,
      userId: order.userId,
      status: order.status,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt,
      items: order.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice
      }))
    };
  }
}

