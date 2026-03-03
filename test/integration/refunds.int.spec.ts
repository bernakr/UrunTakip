import { OrderStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import request from "supertest";
import {
  closeIntegrationContext,
  createIntegrationContext,
  IntegrationContext,
  registerAndLogin
} from "./bootstrap";
import {
  countRefundRequestsByOrderAndIdempotency,
  createOrderForUser,
  resetDatabase
} from "./db";

describe("Refunds integration", () => {
  let context: IntegrationContext;

  beforeAll(async () => {
    context = await createIntegrationContext();
  });

  beforeEach(async () => {
    await resetDatabase(context.prisma);
    context.queueMock.enqueueRefund.mockClear();
  });

  afterAll(async () => {
    await closeIntegrationContext(context);
  });

  it("returns 400 when order is not in PAID status", async () => {
    const auth = await registerAndLogin(
      context.app,
      "refund-not-paid@example.com",
      "Test1234!"
    );
    const order = await createOrderForUser(context.prisma, {
      userId: auth.userId,
      status: OrderStatus.PENDING_PAYMENT,
      totalAmount: 2000
    });

    const response = await request(context.app.getHttpServer())
      .post("/api/refunds")
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({
        orderId: order.orderId,
        amount: 500,
        idempotencyKey: `refund-${randomUUID()}`
      });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe("Only paid orders can be refunded.");
  });

  it("creates refund request for PAID order and enqueues refund job", async () => {
    const auth = await registerAndLogin(
      context.app,
      "refund-success@example.com",
      "Test1234!"
    );
    const order = await createOrderForUser(context.prisma, {
      userId: auth.userId,
      status: OrderStatus.PAID,
      totalAmount: 2000
    });
    const idempotencyKey = `refund-${randomUUID()}`;

    const response = await request(context.app.getHttpServer())
      .post("/api/refunds")
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({
        orderId: order.orderId,
        amount: 500,
        idempotencyKey
      });

    expect(response.status).toBe(201);
    expect(response.body.orderId).toBe(order.orderId);
    expect(response.body.status).toBe("REQUESTED");
    expect(response.body.idempotencyKey).toBe(idempotencyKey);
    expect(context.queueMock.enqueueRefund).toHaveBeenCalledTimes(1);
  });

  it("keeps single refund record for duplicate idempotency key", async () => {
    const auth = await registerAndLogin(
      context.app,
      "refund-idem@example.com",
      "Test1234!"
    );
    const order = await createOrderForUser(context.prisma, {
      userId: auth.userId,
      status: OrderStatus.PAID,
      totalAmount: 2500
    });
    const idempotencyKey = `refund-${randomUUID()}`;

    const firstResponse = await request(context.app.getHttpServer())
      .post("/api/refunds")
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({
        orderId: order.orderId,
        amount: 700,
        idempotencyKey
      });

    const secondResponse = await request(context.app.getHttpServer())
      .post("/api/refunds")
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({
        orderId: order.orderId,
        amount: 700,
        idempotencyKey
      });

    expect(firstResponse.status).toBe(201);
    expect(secondResponse.status).toBe(201);
    expect(secondResponse.body.id).toBe(firstResponse.body.id);

    const count = await countRefundRequestsByOrderAndIdempotency(
      context.prisma,
      order.orderId,
      idempotencyKey
    );
    expect(count).toBe(1);
  });

  it("returns 400 when order is already REFUNDED", async () => {
    const auth = await registerAndLogin(
      context.app,
      "refund-already-refunded@example.com",
      "Test1234!"
    );
    const order = await createOrderForUser(context.prisma, {
      userId: auth.userId,
      status: OrderStatus.REFUNDED,
      totalAmount: 1200
    });

    const response = await request(context.app.getHttpServer())
      .post("/api/refunds")
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({
        orderId: order.orderId,
        amount: 200,
        idempotencyKey: `refund-${randomUUID()}`
      });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe("Only paid orders can be refunded.");
  });
});
