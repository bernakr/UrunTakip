import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const adminPasswordHash = await bcrypt.hash("Admin1234!", 10);
  const customerPasswordHash = await bcrypt.hash("Customer1234!", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {
      passwordHash: adminPasswordHash,
      role: Role.ADMIN
    },
    create: {
      email: "admin@example.com",
      passwordHash: adminPasswordHash,
      role: Role.ADMIN
    }
  });

  const customer = await prisma.user.upsert({
    where: { email: "customer@example.com" },
    update: {
      passwordHash: customerPasswordHash,
      role: Role.CUSTOMER
    },
    create: {
      email: "customer@example.com",
      passwordHash: customerPasswordHash,
      role: Role.CUSTOMER
    }
  });

  const products = [
    {
      sku: "SKU-TSHIRT-001",
      name: "Basic T-Shirt",
      description: "Cotton t-shirt",
      price: 29900,
      stock: 100
    },
    {
      sku: "SKU-HOODIE-001",
      name: "Zip Hoodie",
      description: "Medium weight hoodie",
      price: 79900,
      stock: 50
    },
    {
      sku: "SKU-CAP-001",
      name: "Logo Cap",
      description: "Adjustable cap",
      price: 19900,
      stock: 80
    }
  ];

  for (const item of products) {
    const product = await prisma.product.upsert({
      where: { sku: item.sku },
      update: {
        name: item.name,
        description: item.description,
        price: item.price,
        isActive: true
      },
      create: {
        sku: item.sku,
        name: item.name,
        description: item.description,
        price: item.price,
        isActive: true
      }
    });

    await prisma.inventory.upsert({
      where: { productId: product.id },
      update: {
        onHand: item.stock,
        reserved: 0
      },
      create: {
        productId: product.id,
        onHand: item.stock,
        reserved: 0
      }
    });
  }

  process.stdout.write(
    `Seed completed. admin=${admin.email}, customer=${customer.email}\n`
  );
}

void main()
  .catch((error: unknown) => {
    process.stderr.write(`Seed failed: ${String(error)}\n`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

