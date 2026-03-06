export type Role = "ADMIN" | "CUSTOMER";

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface ForgotPasswordResponse {
  message: string;
  resetToken?: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  price: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  availableStock: number;
}

export interface ProductListResponse {
  items: Product[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CartItem {
  itemId: string;
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Cart {
  cartId: string;
  userId: string;
  items: CartItem[];
  totalAmount: number;
  updatedAt: string;
}

export interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  userId: string;
  status: "PENDING_PAYMENT" | "PAID" | "PAYMENT_FAILED" | "CANCELLED" | "REFUNDED";
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

export interface OrderTimelineEvent {
  type:
    | "ORDER_CREATED"
    | "PAYMENT_ATTEMPT_CREATED"
    | "PAYMENT_SUCCEEDED"
    | "PAYMENT_FAILED"
    | "ORDER_CANCELLED"
    | "REFUND_REQUESTED"
    | "REFUND_PROCESSING"
    | "REFUND_SUCCEEDED"
    | "REFUND_FAILED";
  status: string;
  occurredAt: string;
  detail: string | null;
}

export interface PaymentAttempt {
  id: string;
  orderId: string;
  status: "PENDING" | "SUCCESS" | "FAILED";
  idempotencyKey: string;
  createdAt: string;
}

export interface Refund {
  id: string;
  orderId: string;
  amount: number;
  status: "REQUESTED" | "PROCESSING" | "SUCCEEDED" | "FAILED";
  idempotencyKey: string;
  createdAt: string;
}

export interface Inventory {
  productId: string;
  onHand: number;
  reserved: number;
  available: number;
  updatedAt: string;
}

export interface ApiErrorBody {
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
