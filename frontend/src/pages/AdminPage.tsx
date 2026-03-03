import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/auth-context";
import { useToast } from "../components/toast";
import { api } from "../lib/api";
import type { Inventory, Product } from "../types/api";

function toMinor(priceMajor: string): number {
  const normalized = priceMajor.replace(",", ".").trim();
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.round(parsed * 100);
}

export function AdminPage() {
  const { token } = useAuth();
  const { show } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedInventory, setSelectedInventory] = useState<Inventory | null>(null);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [adjustLoading, setAdjustLoading] = useState(false);

  const loadProducts = useCallback(async (): Promise<void> => {
    try {
      const value = await api.getProducts();
      setProducts(value);
      if (value.length > 0 && !selectedProductId) {
        setSelectedProductId(value[0].id);
      }
    } catch (requestError) {
      const requestMessage =
        requestError instanceof Error ? requestError.message : "Failed to load products.";
      setError(requestMessage);
    }
  }, [selectedProductId]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    if (!token || !selectedProductId) {
      setSelectedInventory(null);
      return;
    }
    setInventoryLoading(true);
    void api
      .getInventory(token, selectedProductId)
      .then((value) => setSelectedInventory(value))
      .catch((requestError) => {
        const requestMessage =
          requestError instanceof Error
            ? requestError.message
            : "Failed to load inventory detail.";
        setError(requestMessage);
      })
      .finally(() => setInventoryLoading(false));
  }, [token, selectedProductId]);

  async function onCreateProduct(
    event: React.FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();
    if (!token) {
      return;
    }

    const form = new FormData(event.currentTarget);
    const sku = String(form.get("sku") ?? "");
    const name = String(form.get("name") ?? "");
    const description = String(form.get("description") ?? "");
    const price = toMinor(String(form.get("price") ?? "0"));
    const initialStock = Number(form.get("initialStock") ?? 0);

    setCreateLoading(true);
    setError(null);
    try {
      await api.createProduct(token, { sku, name, description, price, initialStock });
      show("Product created.", "success");
      event.currentTarget.reset();
      await loadProducts();
    } catch (requestError) {
      const requestMessage =
        requestError instanceof Error ? requestError.message : "Create product failed.";
      setError(requestMessage);
    } finally {
      setCreateLoading(false);
    }
  }

  async function onAdjustInventory(
    event: React.FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();
    if (!token) {
      return;
    }

    const form = new FormData(event.currentTarget);
    const productId = String(form.get("productId") ?? "");
    const delta = Number(form.get("delta") ?? 0);
    const reason = String(form.get("reason") ?? "Manual adjustment from admin UI");

    setAdjustLoading(true);
    setError(null);
    try {
      const result = await api.adjustInventory(token, productId, delta, reason);
      show(
        `Inventory updated. onHand=${result.onHand}, reserved=${result.reserved}, available=${result.available}`
      );
      setSelectedInventory(result);
    } catch (requestError) {
      const requestMessage =
        requestError instanceof Error ? requestError.message : "Inventory update failed.";
      setError(requestMessage);
    } finally {
      setAdjustLoading(false);
    }
  }

  return (
    <section className="page">
      <div className="page-head">
        <h2>Admin</h2>
        <button type="button" onClick={() => void loadProducts()}>
          Refresh products
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}

      <div className="grid two">
        <form className="card form-card" onSubmit={onCreateProduct}>
          <h3>Create Product</h3>
          <label>
            SKU
            <input name="sku" required />
          </label>
          <label>
            Name
            <input name="name" required />
          </label>
          <label>
            Description
            <textarea name="description" rows={3} />
          </label>
          <label>
            Price (TRY)
            <input name="price" type="number" min="0" step="0.01" required />
          </label>
          <label>
            Initial Stock
            <input name="initialStock" type="number" min="0" required />
          </label>
          <button type="submit" disabled={createLoading}>
            {createLoading ? "Creating..." : "Create"}
          </button>
        </form>

        <form className="card form-card" onSubmit={onAdjustInventory}>
          <h3>Adjust Inventory</h3>
          <label>
            Product
            <select
              name="productId"
              value={selectedProductId}
              onChange={(event) => setSelectedProductId(event.target.value)}
              required
            >
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.sku} - {product.name}
                </option>
              ))}
            </select>
          </label>
          {inventoryLoading ? <p className="hint">Loading inventory...</p> : null}
          {selectedInventory ? (
            <p className="hint">
              onHand={selectedInventory.onHand}, reserved={selectedInventory.reserved},
              available={selectedInventory.available}
            </p>
          ) : null}
          <label>
            Delta (+/-)
            <input name="delta" type="number" required />
          </label>
          <label>
            Reason
            <input name="reason" defaultValue="Manual admin adjustment" />
          </label>
          <button type="submit" disabled={adjustLoading}>
            {adjustLoading ? "Applying..." : "Apply"}
          </button>
        </form>
      </div>
    </section>
  );
}
