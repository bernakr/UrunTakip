import request from "supertest";
import {
  closeIntegrationContext,
  createIntegrationContext,
  IntegrationContext
} from "./bootstrap";
import { resetDatabase } from "./db";

describe("Products query integration", () => {
  let context: IntegrationContext;

  beforeAll(async () => {
    context = await createIntegrationContext();
  });

  beforeEach(async () => {
    await resetDatabase(context.prisma);
  });

  afterAll(async () => {
    await closeIntegrationContext(context);
  });

  it("supports pagination and sorting", async () => {
    await context.prisma.product.create({
      data: {
        sku: "SKU-QUERY-001",
        name: "Gamma",
        price: 1200,
        inventory: { create: { onHand: 10, reserved: 0 } }
      }
    });
    await context.prisma.product.create({
      data: {
        sku: "SKU-QUERY-002",
        name: "Alpha",
        price: 3500,
        inventory: { create: { onHand: 10, reserved: 0 } }
      }
    });
    await context.prisma.product.create({
      data: {
        sku: "SKU-QUERY-003",
        name: "Beta",
        price: 2200,
        inventory: { create: { onHand: 10, reserved: 0 } }
      }
    });

    const response = await request(context.app.getHttpServer())
      .get("/api/products?sort=price_desc&page=1&limit=2")
      .expect(200);

    const body = response.body as {
      items: Array<{ price: number }>;
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };

    expect(body.page).toBe(1);
    expect(body.limit).toBe(2);
    expect(body.total).toBe(3);
    expect(body.totalPages).toBe(2);
    expect(body.items).toHaveLength(2);
    expect(body.items[0].price).toBe(3500);
    expect(body.items[1].price).toBe(2200);
  });

  it("supports text search on sku, name and description", async () => {
    await context.prisma.product.create({
      data: {
        sku: "SKU-SEARCH-TSHIRT",
        name: "Basic T-Shirt",
        description: "Soft cotton everyday wear",
        price: 2900,
        inventory: { create: { onHand: 12, reserved: 0 } }
      }
    });

    await context.prisma.product.create({
      data: {
        sku: "SKU-SEARCH-HOODIE",
        name: "Urban Hoodie",
        description: "Heavy hoodie for winter",
        price: 7900,
        inventory: { create: { onHand: 7, reserved: 0 } }
      }
    });

    const response = await request(context.app.getHttpServer())
      .get("/api/products?q=hoodie&page=1&limit=10")
      .expect(200);

    const body = response.body as {
      items: Array<{ sku: string }>;
      total: number;
    };

    expect(body.total).toBe(1);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].sku).toBe("SKU-SEARCH-HOODIE");
  });
});
