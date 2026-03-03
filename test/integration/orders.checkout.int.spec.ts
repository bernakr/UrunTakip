import request from "supertest";
import {
  closeIntegrationContext,
  createIntegrationContext,
  IntegrationContext,
  registerAndLogin
} from "./bootstrap";
import {
  createProductWithInventory,
  findInventoryReserved,
  resetDatabase
} from "./db";

describe("Orders checkout integration", () => {
  let context: IntegrationContext;

  beforeAll(async () => {
    context = await createIntegrationContext();
  });

  beforeEach(async () => {
    await resetDatabase(context.prisma);
    context.queueMock.enqueuePayment.mockClear();
    context.queueMock.enqueueRefund.mockClear();
  });

  afterAll(async () => {
    await closeIntegrationContext(context);
  });

  it("returns 400 when cart is empty", async () => {
    const auth = await registerAndLogin(
      context.app,
      "checkout-empty@example.com",
      "Test1234!"
    );

    const response = await request(context.app.getHttpServer())
      .post("/api/orders/checkout")
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe("Cart is empty.");
  });

  it("returns 400 and keeps reserved stock unchanged when inventory is insufficient", async () => {
    const auth = await registerAndLogin(
      context.app,
      "checkout-insufficient@example.com",
      "Test1234!"
    );
    const fixture = await createProductWithInventory(context.prisma, {
      onHand: 1,
      reserved: 0,
      price: 500
    });

    await request(context.app.getHttpServer())
      .post("/api/cart/items")
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({
        productId: fixture.productId,
        quantity: 2
      })
      .expect(201);

    const checkoutResponse = await request(context.app.getHttpServer())
      .post("/api/orders/checkout")
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({});

    expect(checkoutResponse.status).toBe(400);
    expect(checkoutResponse.body.error.message).toContain("Insufficient stock");

    const reservedAfter = await findInventoryReserved(
      context.prisma,
      fixture.productId
    );
    expect(reservedAfter).toBe(0);

    const orderCount = await context.prisma.order.count({
      where: { userId: auth.userId }
    });
    expect(orderCount).toBe(0);
  });

  it("creates an order, reserves stock and clears cart on successful checkout", async () => {
    const auth = await registerAndLogin(
      context.app,
      "checkout-success@example.com",
      "Test1234!"
    );
    const fixture = await createProductWithInventory(context.prisma, {
      onHand: 10,
      reserved: 1,
      price: 2500
    });

    await request(context.app.getHttpServer())
      .post("/api/cart/items")
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({
        productId: fixture.productId,
        quantity: 2
      })
      .expect(201);

    const checkoutResponse = await request(context.app.getHttpServer())
      .post("/api/orders/checkout")
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({});

    expect(checkoutResponse.status).toBe(201);
    expect(checkoutResponse.body.status).toBe("PENDING_PAYMENT");
    expect(checkoutResponse.body.totalAmount).toBe(5000);
    expect(checkoutResponse.body.items).toHaveLength(1);

    const reservedAfter = await findInventoryReserved(
      context.prisma,
      fixture.productId
    );
    expect(reservedAfter).toBe(3);

    const cart = await context.prisma.cart.findUnique({
      where: { userId: auth.userId },
      include: { items: true }
    });
    expect(cart?.items).toHaveLength(0);
  });
});
