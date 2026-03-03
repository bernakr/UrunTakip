import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { AddCartItemDto } from "./dto/add-cart-item.dto";
import { UpdateCartItemDto } from "./dto/update-cart-item.dto";

export interface CartItemView {
  itemId: string;
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface CartView {
  cartId: string;
  userId: string;
  items: CartItemView[];
  totalAmount: number;
  updatedAt: Date;
}

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async getCart(userId: string): Promise<CartView> {
    const cart = await this.getOrCreateCart(userId);
    const items = await this.prisma.cartItem.findMany({
      where: { cartId: cart.id },
      include: { product: true },
      orderBy: { createdAt: "asc" }
    });

    return this.toCartView(cart.id, userId, cart.updatedAt, items);
  }

  async addItem(userId: string, dto: AddCartItemDto): Promise<CartView> {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId }
    });
    if (!product || !product.isActive) {
      throw new NotFoundException("Product not found or inactive.");
    }

    const cart = await this.getOrCreateCart(userId);

    await this.prisma.cartItem.upsert({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId: dto.productId
        }
      },
      create: {
        cartId: cart.id,
        productId: dto.productId,
        quantity: dto.quantity
      },
      update: {
        quantity: { increment: dto.quantity }
      }
    });

    return this.getCart(userId);
  }

  async updateItem(
    userId: string,
    itemId: string,
    dto: UpdateCartItemDto
  ): Promise<CartView> {
    const cart = await this.getOrCreateCart(userId);
    const item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, cartId: cart.id }
    });
    if (!item) {
      throw new NotFoundException("Cart item not found.");
    }

    await this.prisma.cartItem.update({
      where: { id: item.id },
      data: { quantity: dto.quantity }
    });

    return this.getCart(userId);
  }

  async removeItem(userId: string, itemId: string): Promise<CartView> {
    const cart = await this.getOrCreateCart(userId);
    const item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, cartId: cart.id }
    });
    if (!item) {
      throw new NotFoundException("Cart item not found.");
    }

    await this.prisma.cartItem.delete({ where: { id: item.id } });
    return this.getCart(userId);
  }

  async clearCart(userId: string): Promise<void> {
    const cart = await this.getOrCreateCart(userId);
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  }

  private async getOrCreateCart(
    userId: string
  ): Promise<{ id: string; updatedAt: Date }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException("User not found.");
    }

    const existingCart = await this.prisma.cart.findUnique({
      where: { userId }
    });
    if (existingCart) {
      return { id: existingCart.id, updatedAt: existingCart.updatedAt };
    }

    const created = await this.prisma.cart.create({
      data: { userId }
    });
    return { id: created.id, updatedAt: created.updatedAt };
  }

  private toCartView(
    cartId: string,
    userId: string,
    updatedAt: Date,
    items: Array<{
      id: string;
      productId: string;
      quantity: number;
      product: { sku: string; name: string; price: number };
    }>
  ): CartView {
    const mapped = items.map((item) => ({
      itemId: item.id,
      productId: item.productId,
      sku: item.product.sku,
      name: item.product.name,
      quantity: item.quantity,
      unitPrice: item.product.price,
      lineTotal: item.product.price * item.quantity
    }));
    const totalAmount = mapped.reduce((sum, item) => sum + item.lineTotal, 0);

    return {
      cartId,
      userId,
      items: mapped,
      totalAmount,
      updatedAt
    };
  }
}

