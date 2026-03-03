import { createHmac, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

interface WebhookPayload {
  id: string;
  type: "payment.succeeded" | "payment.failed";
  occurredAt: string;
  data: {
    paymentAttemptId: string;
    orderId: string;
  };
}

interface ProductApi {
  id: string;
  sku: string;
}

interface InventoryApi {
  onHand: number;
  reserved: number;
  available: number;
}

interface AuthApiResponse {
  accessToken: string;
}

interface RefundApi {
  id: string;
  orderId: string;
  amount: number;
  status: "REQUESTED" | "PROCESSING" | "SUCCEEDED" | "FAILED";
}

function signPayload(payload: WebhookPayload): string {
  const secret = process.env.WEBHOOK_SIGNATURE_SECRET ?? "test-webhook-secret";
  return createHmac("sha256", secret)
    .update(JSON.stringify(payload))
    .digest("hex");
}

test("register -> product -> cart -> checkout -> webhook success -> order paid", async ({
  page,
  request
}) => {
  const email = `smoke-${Date.now()}-${Math.floor(Math.random() * 10000)}@example.com`;
  const password = "Smoke1234!";
  const apiBase = process.env.E2E_API_BASE_URL ?? "http://127.0.0.1:3000";

  await page.goto("/register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/^Password$/).fill(password);
  await page.getByLabel("Confirm Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/products$/);

  const addToCartButton = page.getByRole("button", { name: "Add to cart" }).first();
  await expect(addToCartButton).toBeVisible();
  await addToCartButton.click();

  await page.getByRole("link", { name: "Cart" }).click();
  await expect(page).toHaveURL(/\/cart$/);

  const checkoutResponsePromise = page.waitForResponse((response) => {
    return (
      response.request().method() === "POST" &&
      response.url().endsWith("/api/orders/checkout")
    );
  });
  const paymentAttemptResponsePromise = page.waitForResponse((response) => {
    return (
      response.request().method() === "POST" &&
      response.url().endsWith("/api/payments/attempts")
    );
  });

  await page.getByRole("button", { name: "Checkout + Payment" }).click();

  const checkoutResponse = await checkoutResponsePromise;
  expect(checkoutResponse.ok()).toBeTruthy();
  const orderBody = (await checkoutResponse.json()) as { id: string };

  const paymentAttemptResponse = await paymentAttemptResponsePromise;
  expect(paymentAttemptResponse.ok()).toBeTruthy();
  const paymentAttemptBody = (await paymentAttemptResponse.json()) as { id: string };

  await expect(page).toHaveURL(/\/orders$/);
  const orderCard = page
    .locator(".order-card")
    .filter({ hasText: `Order ${orderBody.id.slice(0, 8)}` });
  await expect(orderCard.getByText("Status: PENDING_PAYMENT")).toBeVisible();

  const payload: WebhookPayload = {
    id: `evt-${randomUUID()}`,
    type: "payment.succeeded",
    occurredAt: new Date().toISOString(),
    data: {
      paymentAttemptId: paymentAttemptBody.id,
      orderId: orderBody.id
    }
  };
  const webhookResponse = await request.post(`${apiBase}/api/webhooks/payments`, {
    headers: {
      "content-type": "application/json",
      "x-event-id": payload.id,
      "x-signature": signPayload(payload)
    },
    data: payload
  });
  expect(webhookResponse.ok()).toBeTruthy();

  await page.getByRole("button", { name: "Refresh" }).click();
  await expect(orderCard.getByText("Status: PAID")).toBeVisible();
});

test("refund smoke -> paid order -> request full refund -> verify api record", async ({
  page,
  request
}) => {
  const email = `smoke-refund-${Date.now()}-${Math.floor(Math.random() * 10000)}@example.com`;
  const password = "Smoke1234!";
  const apiBase = process.env.E2E_API_BASE_URL ?? "http://127.0.0.1:3000";

  await page.goto("/register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/^Password$/).fill(password);
  await page.getByLabel("Confirm Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/products$/);

  const addToCartButton = page.getByRole("button", { name: "Add to cart" }).first();
  await expect(addToCartButton).toBeVisible();
  await addToCartButton.click();

  await page.getByRole("link", { name: "Cart" }).click();
  await expect(page).toHaveURL(/\/cart$/);

  const checkoutResponsePromise = page.waitForResponse((response) => {
    return (
      response.request().method() === "POST" &&
      response.url().endsWith("/api/orders/checkout")
    );
  });
  const paymentAttemptResponsePromise = page.waitForResponse((response) => {
    return (
      response.request().method() === "POST" &&
      response.url().endsWith("/api/payments/attempts")
    );
  });

  await page.getByRole("button", { name: "Checkout + Payment" }).click();

  const checkoutResponse = await checkoutResponsePromise;
  expect(checkoutResponse.ok()).toBeTruthy();
  const orderBody = (await checkoutResponse.json()) as { id: string };

  const paymentAttemptResponse = await paymentAttemptResponsePromise;
  expect(paymentAttemptResponse.ok()).toBeTruthy();
  const paymentAttemptBody = (await paymentAttemptResponse.json()) as { id: string };

  await expect(page).toHaveURL(/\/orders$/);
  const orderCard = page
    .locator(".order-card")
    .filter({ hasText: `Order ${orderBody.id.slice(0, 8)}` });
  await expect(orderCard.getByText("Status: PENDING_PAYMENT")).toBeVisible();

  const webhookPayload: WebhookPayload = {
    id: `evt-${randomUUID()}`,
    type: "payment.succeeded",
    occurredAt: new Date().toISOString(),
    data: {
      paymentAttemptId: paymentAttemptBody.id,
      orderId: orderBody.id
    }
  };
  const webhookResponse = await request.post(`${apiBase}/api/webhooks/payments`, {
    headers: {
      "content-type": "application/json",
      "x-event-id": webhookPayload.id,
      "x-signature": signPayload(webhookPayload)
    },
    data: webhookPayload
  });
  expect(webhookResponse.ok()).toBeTruthy();

  await page.getByRole("button", { name: "Refresh" }).click();
  await expect(orderCard.getByText("Status: PAID")).toBeVisible();

  const createRefundResponsePromise = page.waitForResponse((response) => {
    return (
      response.request().method() === "POST" &&
      response.url().endsWith("/api/refunds")
    );
  });
  await orderCard.getByRole("button", { name: "Request full refund" }).click();

  const createRefundResponse = await createRefundResponsePromise;
  expect(createRefundResponse.ok()).toBeTruthy();
  const refundBody = (await createRefundResponse.json()) as RefundApi;
  expect(refundBody.orderId).toBe(orderBody.id);
  expect(refundBody.status).toBe("REQUESTED");

  await expect(orderCard.getByText("Status: PAID")).toBeVisible();

  const loginResponse = await request.post(`${apiBase}/api/auth/login`, {
    data: { email, password }
  });
  expect(loginResponse.ok()).toBeTruthy();
  const loginBody = (await loginResponse.json()) as AuthApiResponse;

  const refundDetailResponse = await request.get(
    `${apiBase}/api/refunds/${refundBody.id}`,
    {
      headers: {
        authorization: `Bearer ${loginBody.accessToken}`
      }
    }
  );
  expect(refundDetailResponse.ok()).toBeTruthy();
  const refundDetail = (await refundDetailResponse.json()) as RefundApi;
  expect(refundDetail.id).toBe(refundBody.id);
  expect(refundDetail.orderId).toBe(orderBody.id);
  expect(refundDetail.status).toBe("REQUESTED");
});

test("admin login -> create product -> adjust inventory -> verify ui and api", async ({
  page,
  request
}) => {
  const adminEmail = "admin@example.com";
  const adminPassword = "Admin1234!";
  const apiBase = process.env.E2E_API_BASE_URL ?? "http://localhost:3000";
  const sku = `SKU-E2E-${Date.now()}`;
  const name = `E2E Product ${Date.now()}`;
  const initialStock = 7;
  const delta = 3;

  await page.goto("/login");
  await page.getByLabel("Email").fill(adminEmail);
  await page.getByLabel("Password").fill(adminPassword);
  await page.getByRole("button", { name: "Login" }).click();

  await expect(page).toHaveURL(/\/products$/);
  await page.getByRole("link", { name: "Admin" }).click();
  await expect(page).toHaveURL(/\/admin$/);

  const createForm = page
    .locator("form")
    .filter({ has: page.getByRole("heading", { name: "Create Product" }) });

  const createProductResponsePromise = page.waitForResponse((response) => {
    return (
      response.request().method() === "POST" &&
      response.url().endsWith("/api/products")
    );
  });

  await createForm.locator('input[name="sku"]').fill(sku);
  await createForm.locator('input[name="name"]').fill(name);
  await createForm.locator('textarea[name="description"]').fill("E2E smoke product");
  await createForm.locator('input[name="price"]').fill("199.99");
  await createForm.locator('input[name="initialStock"]').fill(String(initialStock));
  await createForm.getByRole("button", { name: "Create" }).click();

  const createProductResponse = await createProductResponsePromise;
  expect(createProductResponse.ok()).toBeTruthy();
  await page.getByRole("button", { name: "Refresh products" }).click();

  const adjustForm = page
    .locator("form")
    .filter({ has: page.getByRole("heading", { name: "Adjust Inventory" }) });
  const productOption = adjustForm
    .locator('select[name="productId"] option')
    .filter({ hasText: sku });
  await expect(productOption).toHaveCount(1);

  const productId = await productOption.first().getAttribute("value");
  expect(productId).toBeTruthy();

  const productsResponse = await request.get(`${apiBase}/api/products`);
  expect(productsResponse.ok()).toBeTruthy();
  const products = (await productsResponse.json()) as ProductApi[];
  const createdProduct = products.find((product) => product.sku === sku);
  expect(createdProduct?.id).toBe(productId);

  const loginResponse = await request.post(`${apiBase}/api/auth/login`, {
    data: { email: adminEmail, password: adminPassword }
  });
  expect(loginResponse.ok()).toBeTruthy();
  const loginBody = (await loginResponse.json()) as AuthApiResponse;

  const inventoryBeforeResponse = await request.get(
    `${apiBase}/api/inventory/${productId as string}`,
    {
      headers: {
        authorization: `Bearer ${loginBody.accessToken}`
      }
    }
  );
  expect(inventoryBeforeResponse.ok()).toBeTruthy();
  const inventoryBefore = (await inventoryBeforeResponse.json()) as InventoryApi;
  expect(inventoryBefore.onHand).toBe(initialStock);

  await adjustForm.locator('select[name="productId"]').selectOption(productId as string);
  await adjustForm.locator('input[name="delta"]').fill(String(delta));
  await adjustForm.locator('input[name="reason"]').fill("E2E smoke inventory adjustment");

  const adjustResponsePromise = page.waitForResponse((response) => {
    return (
      response.request().method() === "POST" &&
      response.url().endsWith("/api/inventory/adjustments")
    );
  });

  await adjustForm.getByRole("button", { name: "Apply" }).click();
  const adjustResponse = await adjustResponsePromise;
  expect(adjustResponse.ok()).toBeTruthy();
  const adjustBody = (await adjustResponse.json()) as InventoryApi;
  expect(adjustBody.onHand).toBe(initialStock + delta);
  expect(adjustBody.available).toBe(initialStock + delta);

  await expect(
    adjustForm.getByText(`onHand=${initialStock + delta}, reserved=0, available=${initialStock + delta}`)
  ).toBeVisible();

  const inventoryAfterResponse = await request.get(
    `${apiBase}/api/inventory/${productId as string}`,
    {
      headers: {
        authorization: `Bearer ${loginBody.accessToken}`
      }
    }
  );
  expect(inventoryAfterResponse.ok()).toBeTruthy();
  const inventoryAfter = (await inventoryAfterResponse.json()) as InventoryApi;
  expect(inventoryAfter.onHand).toBe(initialStock + delta);
  expect(inventoryAfter.reserved).toBe(0);
  expect(inventoryAfter.available).toBe(initialStock + delta);
});
