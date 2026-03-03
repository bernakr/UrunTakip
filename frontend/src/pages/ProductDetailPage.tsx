import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/auth-context";
import { useToast } from "../components/toast";
import { api } from "../lib/api";
import type { Product } from "../types/api";

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY"
  }).format(amount / 100);
}

export function ProductDetailPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const { show } = useToast();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      return;
    }
    let active = true;
    const run = async (): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const value = await api.getProductById(id);
        if (active) {
          setProduct(value);
        }
      } catch (requestError) {
        const requestMessage =
          requestError instanceof Error
            ? requestError.message
            : "Failed to load product detail.";
        if (active) {
          setError(requestMessage);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    void run();

    return () => {
      active = false;
    };
  }, [id]);

  async function addToCart(): Promise<void> {
    if (!token || !product) {
      navigate("/login");
      return;
    }
    try {
      await api.addCartItem(token, product.id, quantity);
      show(`${product.name} added to cart.`, "success");
    } catch (requestError) {
      const requestMessage =
        requestError instanceof Error ? requestError.message : "Add to cart failed.";
      show(requestMessage, "error");
    }
  }

  return (
    <section className="page">
      <div className="page-head">
        <h2>Product Detail</h2>
        <Link to="/products">Back to products</Link>
      </div>
      {loading ? <p className="hint">Loading...</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {product ? (
        <article className="card detail-card">
          <header>
            <span className="badge">{product.sku}</span>
            <h3>{product.name}</h3>
          </header>
          <p>{product.description ?? "No description."}</p>
          <div className="detail-meta">
            <strong>{formatPrice(product.price)}</strong>
            <span>Available stock: {product.availableStock}</span>
          </div>
          <label className="inline-field">
            Quantity
            <input
              type="number"
              min={1}
              max={Math.max(product.availableStock, 1)}
              value={quantity}
              onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
            />
          </label>
          <div className="row-actions">
            <button
              type="button"
              onClick={() => void addToCart()}
              disabled={product.availableStock <= 0}
            >
              {product.availableStock > 0 ? "Add to cart" : "Out of stock"}
            </button>
            <Link to="/cart">Go to cart</Link>
          </div>
        </article>
      ) : null}
    </section>
  );
}
