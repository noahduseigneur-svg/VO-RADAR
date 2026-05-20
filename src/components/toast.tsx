"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

type ToastKind = "success" | "error" | "info" | "warn";

interface ToastItem { id: number; kind: ToastKind; message: string }

interface ToastCtx {
  show: (kind: ToastKind, message: string) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const show = useCallback((kind: ToastKind, message: string) => {
    const id = nextId++;
    setItems((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {items.map((t) => (
          <ToastView key={t.id} item={t} onClose={() => setItems((prev) => prev.filter((x) => x.id !== t.id))} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

function ToastView({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setVisible(true); }, []);

  const cls = item.kind === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
    : item.kind === "error" ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
    : item.kind === "warn" ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
    : "border-[var(--border)] bg-[var(--card)] text-neutral-200";

  const Icon = item.kind === "success" ? CheckCircle2
    : item.kind === "error" ? XCircle
    : item.kind === "warn" ? AlertTriangle
    : Info;

  return (
    <div
      className={`pointer-events-auto flex items-start gap-2 rounded-lg border px-3.5 py-2.5 text-sm shadow-2xl backdrop-blur transition-all duration-200 ${cls} ${visible ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0"}`}
      role="status"
    >
      <Icon size={16} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">{item.message}</div>
      <button onClick={onClose} className="shrink-0 text-neutral-400 hover:text-white" aria-label="Fermer">
        <X size={14} />
      </button>
    </div>
  );
}

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Fallback when no provider (e.g., test or outside (app))
    return { show: () => {} };
  }
  return ctx;
}
