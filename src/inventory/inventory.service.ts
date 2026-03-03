import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";
import { AdjustInventoryDto } from "./dto/adjust-inventory.dto";

export interface InventoryView {
  productId: string;
  onHand: number;
  reserved: number;
  available: number;
  updatedAt: Date;
}

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getByProductId(productId: string): Promise<InventoryView> {
    const inventory = await this.prisma.inventory.findUnique({
      where: { productId }
    });
    if (!inventory) {
      throw new NotFoundException("Inventory record not found.");
    }

    return {
      productId: inventory.productId,
      onHand: inventory.onHand,
      reserved: inventory.reserved,
      available: inventory.onHand - inventory.reserved,
      updatedAt: inventory.updatedAt
    };
  }

  async adjust(dto: AdjustInventoryDto): Promise<InventoryView> {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const inventory = await tx.inventory.findUnique({
        where: { productId: dto.productId }
      });
      if (!inventory) {
        throw new NotFoundException("Inventory record not found.");
      }

      const nextOnHand = inventory.onHand + dto.delta;
      if (nextOnHand < 0) {
        throw new BadRequestException("on_hand cannot be negative.");
      }
      if (nextOnHand < inventory.reserved) {
        throw new BadRequestException(
          "on_hand cannot be below reserved stock."
        );
      }

      const updated = await tx.inventory.update({
        where: { id: inventory.id },
        data: { onHand: nextOnHand }
      });

      return {
        productId: updated.productId,
        onHand: updated.onHand,
        reserved: updated.reserved,
        available: updated.onHand - updated.reserved,
        updatedAt: updated.updatedAt
      };
    });
  }
}
