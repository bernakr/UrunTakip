import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { ListProductsQueryDto, ProductSort } from "./dto/list-products-query.dto";

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

export interface ProductListResponse {
  items: ProductListItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
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

    return mapProduct(product);
  }

  async list(query: ListProductsQueryDto): Promise<ProductListResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 12;
    const where = buildWhereClause(query.q);

    const [total, products] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: { inventory: true },
        orderBy: mapSort(query.sort),
        skip: (page - 1) * limit,
        take: limit
      })
    ]);

    return {
      items: products.map(mapProduct),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    };
  }

  async getById(id: string): Promise<ProductListItem> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { inventory: true }
    });
    if (!product) {
      throw new NotFoundException("Product not found.");
    }

    return mapProduct(product);
  }
}

function buildWhereClause(searchQuery: string | undefined): Prisma.ProductWhereInput {
  const normalized = searchQuery?.trim();
  if (!normalized) {
    return {};
  }

  return {
    OR: [
      {
        sku: {
          contains: normalized,
          mode: "insensitive"
        }
      },
      {
        name: {
          contains: normalized,
          mode: "insensitive"
        }
      },
      {
        description: {
          contains: normalized,
          mode: "insensitive"
        }
      }
    ]
  };
}

function mapSort(sort: ProductSort | undefined): Prisma.ProductOrderByWithRelationInput {
  if (sort === "oldest") {
    return { createdAt: "asc" };
  }
  if (sort === "price_asc") {
    return { price: "asc" };
  }
  if (sort === "price_desc") {
    return { price: "desc" };
  }
  if (sort === "name_asc") {
    return { name: "asc" };
  }
  if (sort === "name_desc") {
    return { name: "desc" };
  }

  return { createdAt: "desc" };
}

function mapProduct(product: {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  price: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  inventory: { onHand: number; reserved: number } | null;
}): ProductListItem {
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    description: product.description,
    price: product.price,
    isActive: product.isActive,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    availableStock: (product.inventory?.onHand ?? 0) - (product.inventory?.reserved ?? 0)
  };
}
