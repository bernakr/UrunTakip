import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { CreateProductDto } from "./dto/create-product.dto";

export interface ProductListItem {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  price: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  availableStock: number;
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProductDto): Promise<ProductListItem> {
    const product = await this.prisma.product.create({
      data: {
        sku: dto.sku,
        name: dto.name,
        description: dto.description,
        price: dto.price,
        isActive: dto.isActive ?? true,
        inventory: {
          create: {
            onHand: dto.initialStock ?? 0,
            reserved: 0
          }
        }
      },
      include: {
        inventory: true
      }
    });

    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      description: product.description,
      price: product.price,
      isActive: product.isActive,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      availableStock:
        (product.inventory?.onHand ?? 0) - (product.inventory?.reserved ?? 0)
    };
  }

  async list(): Promise<ProductListItem[]> {
    const products = await this.prisma.product.findMany({
      include: { inventory: true },
      orderBy: { createdAt: "desc" }
    });

    return products.map((product) => ({
      id: product.id,
      sku: product.sku,
      name: product.name,
      description: product.description,
      price: product.price,
      isActive: product.isActive,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      availableStock:
        (product.inventory?.onHand ?? 0) - (product.inventory?.reserved ?? 0)
    }));
  }

  async getById(id: string): Promise<ProductListItem> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { inventory: true }
    });
    if (!product) {
      throw new NotFoundException("Product not found.");
    }

    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      description: product.description,
      price: product.price,
      isActive: product.isActive,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      availableStock:
        (product.inventory?.onHand ?? 0) - (product.inventory?.reserved ?? 0)
    };
  }
}

