import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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

export function ProductsPage() {
  const { token, isAuthenticated } = useAuth();
  const { show } = useToast();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeProducts = useMemo(
    () => products.filter((product) => product.isActive),
    [products]
  );

  const loadProducts = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.getProducts();
      setProducts(list);
    } catch (requestError) {
      const requestMessage =
        requestError instanceof Error ? requestError.message : "Failed to load products.";
      setError(requestMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  async function addToCart(productId: string): Promise<void> {
    if (!isAuthenticated || !token) {
      navigate("/login");
      return;
    }
    try {
      await api.addCartItem(token, productId, 1);
      show("Product added to cart.", "success");
    } catch (requestError) {
      const requestMessage =
        requestError instanceof Error ? requestError.message : "Failed to add product.";
      show(requestMessage, "error");
    }
  }

  return (
    <section className="page">
      <div className="page-head">
        <h2>Products</h2>
        <button type="button" onClick={() => void loadProducts()} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
      <div className="grid">
        {activeProducts.map((product) => (
          <article className="card product-card" key={product.id}>
            <header>
              <span className="badge">{product.sku}</span>
              <h3>{product.name}</h3>
            </header>
            <p>{product.description ?? "No description."}</p>
            <div className="meta">
              <strong>{formatPrice(product.price)}</strong>
              <span>Stock: {product.availableStock}</span>
            </div>
            <div className="row-actions">
              <button
                type="button"
                onClick={() => void addToCart(product.id)}
                disabled={product.availableStock <= 0}
              >
                {product.availableStock > 0 ? "Add to cart" : "Out of stock"}
              </button>
              <Link to={`/products/${product.id}`}>Details</Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
