import type {
  ApiErrorBody,
  AuthResponse,
  Cart,
  ForgotPasswordResponse,
  Inventory,
  Order,
  OrderTimelineEvent,
  PaymentAttempt,
  Product,
  ProductListResponse,
  Refund
} from "../types/api";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

export type ProductSort =
  | "newest"
  | "oldest"
  | "price_asc"
  | "price_desc"
  | "name_asc"
  | "name_desc";

interface ProductListParams {
  q?: string;
  sort?: ProductSort;
  page?: number;
  limit?: number;
}

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) {
    throw new Error("Empty response body.");
  }
  return JSON.parse(text) as T;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers = new Headers(options.headers ?? {});
  if (!headers.has("content-type") && options.body) {
    headers.set("content-type", "application/json");
  }
  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${apiBaseUrl}/api${path}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const errorBody = await parseJson<ApiErrorBody>(response);
      message = errorBody.error.message;
    } catch {
      const fallbackMessage = await response.text();
      if (fallbackMessage) {
        message = fallbackMessage;
      }
    }
    throw new Error(message);
  }

  return parseJson<T>(response);
}

function toProductsPath(params: ProductListParams = {}): string {
  const query = new URLSearchParams();
  if (params.q?.trim()) {
    query.set("q", params.q.trim());
  }
  if (params.sort) {
    query.set("sort", params.sort);
  }
  if (typeof params.page === "number") {
    query.set("page", String(params.page));
  }
  if (typeof params.limit === "number") {
    query.set("limit", String(params.limit));
  }

  const queryString = query.toString();
  if (!queryString) {
    return "/products";
  }

  return `/products?${queryString}`;
}

export const api = {
  register(email: string, password: string): Promise<AuthResponse> {
    return request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
  },

  login(email: string, password: string): Promise<AuthResponse> {
    return request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
  },

  refresh(refreshToken: string): Promise<AuthResponse> {
    return request<AuthResponse>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken })
    });
  },

  forgotPassword(email: string): Promise<ForgotPasswordResponse> {
    return request<ForgotPasswordResponse>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email })
    });
  },

  resetPassword(token: string, newPassword: string): Promise<AuthResponse> {
    return request<AuthResponse>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, newPassword })
    });
  },

  logout(refreshToken: string): Promise<{ success: true }> {
    return request<{ success: true }>("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken })
    });
  },

  getProducts(params: ProductListParams = {}): Promise<ProductListResponse> {
    return request<ProductListResponse>(toProductsPath(params), { method: "GET" });
  },

  getProductById(productId: string): Promise<Product> {
    return request<Product>(`/products/${productId}`, { method: "GET" });
  },

  createProduct(
    token: string,
    payload: {
      sku: string;
      name: string;
      description?: string;
      price: number;
      initialStock: number;
    }
  ): Promise<Product> {
    return request<Product>(
      "/products",
      { method: "POST", body: JSON.stringify(payload) },
      token
    );
  },

  getCart(token: string): Promise<Cart> {
    return request<Cart>("/cart", { method: "GET" }, token);
  },

  addCartItem(token: string, productId: string, quantity: number): Promise<Cart> {
    return request<Cart>(
      "/cart/items",
      { method: "POST", body: JSON.stringify({ productId, quantity }) },
      token
    );
  },

  updateCartItem(token: string, itemId: string, quantity: number): Promise<Cart> {
    return request<Cart>(
      `/cart/items/${itemId}`,
      { method: "PATCH", body: JSON.stringify({ quantity }) },
      token
    );
  },

  removeCartItem(token: string, itemId: string): Promise<Cart> {
    return request<Cart>(`/cart/items/${itemId}`, { method: "DELETE" }, token);
  },

  checkout(token: string): Promise<Order> {
    return request<Order>(
      "/orders/checkout",
      { method: "POST", body: JSON.stringify({}) },
      token
    );
  },

  listOrders(token: string): Promise<Order[]> {
    return request<Order[]>("/orders", { method: "GET" }, token);
  },

  cancelOrder(token: string, orderId: string): Promise<Order> {
    return request<Order>(`/orders/${orderId}/cancel`, { method: "POST" }, token);
  },

  getOrderTimeline(token: string, orderId: string): Promise<OrderTimelineEvent[]> {
    return request<OrderTimelineEvent[]>(`/orders/${orderId}/timeline`, { method: "GET" }, token);
  },

  createPaymentAttempt(
    token: string,
    orderId: string,
    idempotencyKey: string
  ): Promise<PaymentAttempt> {
    return request<PaymentAttempt>(
      "/payments/attempts",
      {
        method: "POST",
        body: JSON.stringify({ orderId, idempotencyKey })
      },
      token
    );
  },

  createRefund(
    token: string,
    orderId: string,
    amount: number,
    idempotencyKey: string,
    reason?: string
  ): Promise<Refund> {
    return request<Refund>(
      "/refunds",
      {
        method: "POST",
        body: JSON.stringify({ orderId, amount, idempotencyKey, reason })
      },
      token
    );
  },

  adjustInventory(
    token: string,
    productId: string,
    delta: number,
    reason?: string
  ): Promise<Inventory> {
    return request<Inventory>(
      "/inventory/adjustments",
      {
        method: "POST",
        body: JSON.stringify({ productId, delta, reason })
      },
      token
    );
  },

  getInventory(token: string, productId: string): Promise<Inventory> {
    return request<Inventory>(`/inventory/${productId}`, { method: "GET" }, token);
  }
};
