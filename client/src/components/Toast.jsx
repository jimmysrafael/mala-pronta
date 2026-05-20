import { useState, useEffect, createContext, useContext, useCallback } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type, exiting: false }]);
    setTimeout(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
      );
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 300);
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div className="fixed bottom-24 left-0 right-0 z-[100] flex flex-col items-center gap-2 px-4 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-5 py-3 rounded-2xl shadow-lg flex items-center gap-2 pointer-events-auto font-body text-sm font-medium ${
              toast.exiting ? 'toast-exit' : 'toast-enter'
            }`}
            style={{
              background: toast.type === 'error' ? '#fef2f2' : '#f0fdf4',
              color: toast.type === 'error' ? '#ba1a1a' : '#0f5238',
              boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
            }}
          >
            <span className="material-symbols-rounded filled text-[20px]">
              {toast.type === 'error' ? 'error' : 'check_circle'}
            </span>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
