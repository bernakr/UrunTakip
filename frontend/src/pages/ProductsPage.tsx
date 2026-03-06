import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/auth-context";
import { useToast } from "../components/toast";
import { api, type ProductSort } from "../lib/api";
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
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ProductSort>("newest");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const activeProducts = useMemo(
    () => products.filter((product) => product.isActive),
    [products]
  );

  const loadProducts = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.getProducts({
        q: query,
        sort,
        page,
        limit: 9
      });
      setProducts(response.items);
      setTotal(response.total);
      setTotalPages(response.totalPages);
    } catch (requestError) {
      const requestMessage =
        requestError instanceof Error ? requestError.message : "Failed to load products.";
      setError(requestMessage);
    } finally {
      setLoading(false);
    }
  }, [page, query, sort]);

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

      <div className="card form-card">
        <label>
          Search
          <input
            value={query}
            onChange={(event) => {
              setPage(1);
              setQuery(event.target.value);
            }}
            placeholder="SKU, name or description"
          />
        </label>
        <label>
          Sort
          <select
            value={sort}
            onChange={(event) => {
              setPage(1);
              setSort(event.target.value as ProductSort);
            }}
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="price_asc">Price low to high</option>
            <option value="price_desc">Price high to low</option>
            <option value="name_asc">Name A-Z</option>
            <option value="name_desc">Name Z-A</option>
          </select>
        </label>
      </div>

      {error ? <p className="error">{error}</p> : null}
      <p className="hint">
        {total} products found. Page {page} / {totalPages}
      </p>

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

      <div className="row-actions" style={{ marginTop: "0.8rem" }}>
        <button
          type="button"
          onClick={() => setPage((previous) => Math.max(1, previous - 1))}
          disabled={loading || page <= 1}
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => setPage((previous) => Math.min(totalPages, previous + 1))}
          disabled={loading || page >= totalPages}
        >
          Next
        </button>
      </div>
    </section>
  );
}
