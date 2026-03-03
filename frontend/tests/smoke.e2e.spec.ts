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
