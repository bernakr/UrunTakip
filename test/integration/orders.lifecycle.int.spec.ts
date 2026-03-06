import { OrderStatus } from "@prisma/client";
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

describe("Orders lifecycle integration", () => {
  let context: IntegrationContext;

  beforeAll(async () => {
    context = await createIntegrationContext();
  });

  beforeEach(async () => {
    await resetDatabase(context.prisma);
    context.queueMock.enqueuePayment.mockClear();
  });

  afterAll(async () => {
    await closeIntegrationContext(context);
  });

  it("cancels a pending order and releases reserved stock", async () => {
    const auth = await registerAndLogin(
      context.app,
      `cancel-pending-${Date.now()}@example.com`,
      "Test1234!"
    );

    const fixture = await createProductWithInventory(context.prisma, {
      onHand: 6,
      reserved: 0,
      price: 2000
    });

    await request(context.app.getHttpServer())
      .post("/api/cart/items")
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({ productId: fixture.productId, quantity: 2 })
      .expect(201);

    const checkoutResponse = await request(context.app.getHttpServer())
      .post("/api/orders/checkout")
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({})
      .expect(201);

    const checkoutBody = checkoutResponse.body as { id: string; status: string };
    expect(checkoutBody.status).toBe("PENDING_PAYMENT");

    const reservedAfterCheckout = await findInventoryReserved(
      context.prisma,
      fixture.productId
    );
    expect(reservedAfterCheckout).toBe(2);

    const cancelResponse = await request(context.app.getHttpServer())
      .post(`/api/orders/${checkoutBody.id}/cancel`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({})
      .expect(201);

    expect(cancelResponse.body.status).toBe("CANCELLED");

    const reservedAfterCancel = await findInventoryReserved(
      context.prisma,
      fixture.productId
    );
    expect(reservedAfterCancel).toBe(0);

    const timelineResponse = await request(context.app.getHttpServer())
      .get(`/api/orders/${checkoutBody.id}/timeline`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .expect(200);

    const timelineBody = timelineResponse.body as Array<{ type: string }>;
    expect(timelineBody.some((event) => event.type === "ORDER_CREATED")).toBe(true);
    expect(timelineBody.some((event) => event.type === "ORDER_CANCELLED")).toBe(true);
  });

  it("rejects cancellation for paid orders", async () => {
    const auth = await registerAndLogin(
      context.app,
      `cancel-paid-${Date.now()}@example.com`,
      "Test1234!"
    );

    const order = await context.prisma.order.create({
      data: {
        userId: auth.userId,
        status: OrderStatus.PAID,
        totalAmount: 5000
      }
    });

    const cancelResponse = await request(context.app.getHttpServer())
      .post(`/api/orders/${order.id}/cancel`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({});

    expect(cancelResponse.status).toBe(400);
    expect(cancelResponse.body.error.message).toBe(
      "Paid or refunded orders cannot be cancelled."
    );
  });
});
