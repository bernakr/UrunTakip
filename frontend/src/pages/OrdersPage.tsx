import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/auth-context";
import { useToast } from "../components/toast";
import { api } from "../lib/api";
import type { Order } from "../types/api";

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY"
  }).format(amount / 100);
}

export function OrdersPage() {
  const { token } = useAuth();
  const { show } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const statusSnapshotRef = useRef<Record<string, Order["status"]>>({});

  const hasPendingOrders = useMemo(
    () => orders.some((order) => order.status === "PENDING_PAYMENT"),
    [orders]
  );

  const loadOrders = useCallback(async (silent = false): Promise<void> => {
    if (!token) {
      return;
    }
    if (!silent) {
      setLoading(true);
    }
    setError(null);
    try {
      const value = await api.listOrders(token);
      for (const order of value) {
        const previousStatus = statusSnapshotRef.current[order.id];
        if (previousStatus === "PENDING_PAYMENT" && order.status !== "PENDING_PAYMENT") {
          if (order.status === "PAID") {
            show(`Order ${order.id.slice(0, 8)} is now PAID.`, "success");
          } else if (order.status === "PAYMENT_FAILED") {
            show(`Order ${order.id.slice(0, 8)} payment failed.`, "error");
          }
        }
        statusSnapshotRef.current[order.id] = order.status;
      }
      setOrders(value);
    } catch (requestError) {
      const requestMessage =
        requestError instanceof Error ? requestError.message : "Failed to load orders.";
      setError(requestMessage);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [token, show]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (!hasPendingOrders) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadOrders(true);
    }, 4000);

    return () => {
      window.clearInterval(timer);
    };
  }, [hasPendingOrders, loadOrders]);

  async function retryPayment(orderId: string): Promise<void> {
    if (!token) {
      return;
    }
    setError(null);
    try {
      await api.createPaymentAttempt(token, orderId, crypto.randomUUID());
      show("Payment attempt queued.", "info");
      await loadOrders();
    } catch (requestError) {
      const requestMessage =
        requestError instanceof Error ? requestError.message : "Payment retry failed.";
      show(requestMessage, "error");
    }
  }

  async function requestRefund(orderId: string, amount: number): Promise<void> {
    if (!token) {
      return;
    }
    setError(null);
    try {
      await api.createRefund(token, orderId, amount, crypto.randomUUID(), "UI request");
      show("Refund request created.", "success");
      await loadOrders();
    } catch (requestError) {
      const requestMessage =
        requestError instanceof Error ? requestError.message : "Refund failed.";
      show(requestMessage, "error");
    }
  }

  return (
    <section className="page">
      <div className="page-head">
        <h2>Orders</h2>
        <button type="button" onClick={() => void loadOrders()} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {hasPendingOrders ? (
        <p className="hint">Auto-refresh is active while pending payments exist.</p>
      ) : null}
      <div className="stack">
        {orders.map((order) => (
          <article key={order.id} className="card order-card">
            <header>
              <div>
                <h3>Order {order.id.slice(0, 8)}</h3>
                <p>Status: {order.status}</p>
              </div>
              <strong>{formatPrice(order.totalAmount)}</strong>
            </header>
            <ul>
              {order.items.map((item) => (
                <li key={`${order.id}-${item.productId}`}>
                  {item.productId.slice(0, 6)}... x{item.quantity} @{" "}
                  {formatPrice(item.unitPrice)}
                </li>
              ))}
            </ul>
            <div className="row-actions">
              {order.status === "PENDING_PAYMENT" || order.status === "PAYMENT_FAILED" ? (
                <button type="button" onClick={() => void retryPayment(order.id)}>
                  Retry payment
                </button>
              ) : null}
              {order.status === "PAID" ? (
                <button
                  type="button"
                  onClick={() => void requestRefund(order.id, order.totalAmount)}
                >
                  Request full refund
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
