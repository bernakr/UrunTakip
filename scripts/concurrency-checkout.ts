/* eslint-disable no-console */
import "dotenv/config";

interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    role: "ADMIN" | "CUSTOMER";
  };
}

interface ProductResponse {
  id: string;
  sku: string;
  name: string;
  availableStock: number;
}

interface CheckoutResponse {
  id: string;
  status: string;
  totalAmount: number;
}

interface InventoryResponse {
  productId: string;
  onHand: number;
  reserved: number;
  available: number;
}

interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    status: number;
  };
  requestId: string | null;
  timestamp: string;
  method: string;
  path: string;
}

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:3000";
const usersCount = Number(process.env.CONCURRENCY_USERS ?? "20");
const initialStock = Number(process.env.CONCURRENCY_STOCK ?? "7");

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) {
    throw new Error("Empty response body");
  }
  return JSON.parse(text) as T;
}

async function register(
  email: string,
  password: string
): Promise<AuthResponse> {
  const response = await fetch(`${apiBaseUrl}/api/auth/register`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ email, password })
  });

  if (!response.ok) {
    const body = await parseJson<ApiErrorResponse>(response);
    throw new Error(`Register failed (${response.status}): ${body.error.message}`);
  }

  return parseJson<AuthResponse>(response);
}

async function login(email: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ email, password })
  });

  if (!response.ok) {
    const body = await parseJson<ApiErrorResponse>(response);
    throw new Error(`Login failed (${response.status}): ${body.error.message}`);
  }

  return parseJson<AuthResponse>(response);
}

async function createProduct(
  token: string,
  sku: string,
  stock: number
): Promise<ProductResponse> {
  const response = await fetch(`${apiBaseUrl}/api/products`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      sku,
      name: "Concurrency Demo Product",
      description: "Used for oversell prevention stress test.",
      price: 9900,
      initialStock: stock
    })
  });

  if (!response.ok) {
    const body = await parseJson<ApiErrorResponse>(response);
    throw new Error(
      `Create product failed (${response.status}): ${body.error.message}`
    );
  }

  return parseJson<ProductResponse>(response);
}

async function addToCart(token: string, productId: string): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/api/cart/items`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ productId, quantity: 1 })
  });

  if (!response.ok) {
    const body = await parseJson<ApiErrorResponse>(response);
    throw new Error(`Add to cart failed (${response.status}): ${body.error.message}`);
  }
}

async function checkout(
  token: string
): Promise<{ ok: true; order: CheckoutResponse } | { ok: false; error: string }> {
  const response = await fetch(`${apiBaseUrl}/api/orders/checkout`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify({})
  });

  if (!response.ok) {
    const body = await parseJson<ApiErrorResponse>(response);
    return { ok: false, error: body.error.message };
  }

  const order = await parseJson<CheckoutResponse>(response);
  return { ok: true, order };
}

async function getInventory(token: string, productId: string): Promise<InventoryResponse> {
  const response = await fetch(`${apiBaseUrl}/api/inventory/${productId}`, {
    method: "GET",
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const body = await parseJson<ApiErrorResponse>(response);
    throw new Error(`Get inventory failed (${response.status}): ${body.error.message}`);
  }

  return parseJson<InventoryResponse>(response);
}

async function main(): Promise<void> {
  const runId = Date.now();
  const adminEmail = process.env.CONCURRENCY_ADMIN_EMAIL ?? "admin@example.com";
  const adminPassword = process.env.CONCURRENCY_ADMIN_PASSWORD ?? "Admin1234!";
  const customerPassword = "Customer1234!";
  const sku = `SKU-CONC-${runId}`;

  console.log("Starting concurrency checkout test...");
  console.log(`API_BASE_URL=${apiBaseUrl}`);
  console.log(`users=${usersCount}, stock=${initialStock}`);

  const adminAuth = await login(adminEmail, adminPassword);
  const product = await createProduct(adminAuth.accessToken, sku, initialStock);
  console.log(`Created product ${product.id} with stock=${initialStock}`);

  const customerTokens: string[] = [];
  for (let index = 0; index < usersCount; index += 1) {
    const email = `customer+${runId}+${index}@example.com`;
    const customerAuth = await register(email, customerPassword);
    customerTokens.push(customerAuth.accessToken);
  }

  await Promise.all(customerTokens.map((token) => addToCart(token, product.id)));
  console.log("All customers added 1 unit to cart.");

  const checkoutResults = await Promise.all(customerTokens.map((token) => checkout(token)));
  const successResults = checkoutResults.filter(
    (result): result is { ok: true; order: CheckoutResponse } => result.ok
  );
  const failedResults = checkoutResults.filter(
    (result): result is { ok: false; error: string } => !result.ok
  );

  const inventory = await getInventory(adminAuth.accessToken, product.id);
  const soldByOrders = successResults.length;
  const accountedStock = inventory.available + inventory.reserved;

  console.log(`Checkout success=${soldByOrders}, failed=${failedResults.length}`);
  console.log(
    `Inventory onHand=${inventory.onHand}, reserved=${inventory.reserved}, available=${inventory.available}`
  );

  if (soldByOrders > initialStock) {
    throw new Error(
      `Oversell detected: success orders (${soldByOrders}) > initial stock (${initialStock}).`
    );
  }

  if (accountedStock !== initialStock) {
    throw new Error(
      `Inventory mismatch: available + reserved (${accountedStock}) != initial stock (${initialStock}).`
    );
  }

  const uniqueFailureMessages = Array.from(new Set(failedResults.map((item) => item.error)));
  if (uniqueFailureMessages.length > 0) {
    console.log(`Failure reasons: ${uniqueFailureMessages.join(" | ")}`);
  }

  console.log("Concurrency checkout test passed: oversell protection is working.");
}

void main().catch((error: unknown) => {
  console.error("Concurrency test failed:", error);
  process.exit(1);
});
