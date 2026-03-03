/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode
} from "react";

type ToastLevel = "success" | "error" | "info";

interface ToastItem {
  id: string;
  message: string;
  level: ToastLevel;
}

interface ToastContextValue {
  show: (message: string, level?: ToastLevel) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, level: ToastLevel = "info"): void => {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { id, message, level }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 3800);
  }, []);

  const remove = useCallback((id: string): void => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.level}`}>
            <span>{toast.message}</span>
            <button type="button" onClick={() => remove(toast.id)}>
              x
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider.");
  }
  return context;
}

