import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/auth-context";
import { useToast } from "../components/toast";
import { api } from "../lib/api";
import type { Cart } from "../types/api";

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY"
  }).format(amount / 100);
}

export function CartPage() {
  const { token } = useAuth();
  const { show } = useToast();
  const navigate = useNavigate();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCart = useCallback(async (): Promise<void> => {
    if (!token) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const value = await api.getCart(token);
      setCart(value);
    } catch (requestError) {
      const requestMessage =
        requestError instanceof Error ? requestError.message : "Failed to load cart.";
      setError(requestMessage);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadCart();
  }, [loadCart]);

  async function changeQuantity(itemId: string, quantity: number): Promise<void> {
    if (!token) {
      return;
    }
    setError(null);
    try {
      const value = await api.updateCartItem(token, itemId, quantity);
      setCart(value);
      show("Cart updated.", "success");
    } catch (requestError) {
      const requestMessage =
        requestError instanceof Error ? requestError.message : "Update failed.";
      show(requestMessage, "error");
    }
  }

  async function removeItem(itemId: string): Promise<void> {
    if (!token) {
      return;
    }
    setError(null);
    try {
      const value = await api.removeCartItem(token, itemId);
      setCart(value);
      show("Item removed.", "success");
    } catch (requestError) {
      const requestMessage =
        requestError instanceof Error ? requestError.message : "Remove failed.";
      show(requestMessage, "error");
    }
  }

  async function checkout(): Promise<void> {
    if (!token) {
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const order = await api.checkout(token);
      await api.createPaymentAttempt(token, order.id, crypto.randomUUID());
      show("Checkout completed. Payment simulation started.", "success");
      navigate("/orders");
    } catch (requestError) {
      const requestMessage =
        requestError instanceof Error ? requestError.message : "Checkout failed.";
      show(requestMessage, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="page">
      <div className="page-head">
        <h2>Cart</h2>
        <button type="button" onClick={() => void loadCart()} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {cart?.items.length ? (
        <div className="table-wrap card">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Unit</th>
                <th>Qty</th>
                <th>Line Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {cart.items.map((item) => (
                <tr key={item.itemId}>
                  <td>{item.name}</td>
                  <td>{formatPrice(item.unitPrice)}</td>
                  <td>
                    <input
                      type="number"
                      min={1}
                      defaultValue={item.quantity}
                      onBlur={(event) => {
                        const next = Number(event.target.value);
                        if (Number.isFinite(next) && next > 0 && next !== item.quantity) {
                          void changeQuantity(item.itemId, next);
                        }
                      }}
                    />
                  </td>
                  <td>{formatPrice(item.lineTotal)}</td>
                  <td>
                    <button type="button" onClick={() => void removeItem(item.itemId)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="cart-footer">
            <strong>Total: {formatPrice(cart.totalAmount)}</strong>
            <button type="button" onClick={() => void checkout()} disabled={loading}>
              Checkout + Payment
            </button>
          </div>
        </div>
      ) : (
        <p className="hint">Cart is empty.</p>
      )}
    </section>
  );
}
