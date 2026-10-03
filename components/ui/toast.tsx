"use client";

// components/ui/toast.tsx
// Premium custom toast system — no external dependency needed.
// Matches the Brainzima design system.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  duration?: number; // ms, default 5000
  action?: ToastAction;
}

interface ToastContextValue {
  toasts: Toast[];
  toast: (t: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
}

// ── Context ────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...t, id }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      <ToastViewport toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

// ── Config per variant ─────────────────────────────────────────────────────

const variantConfig: Record<
  ToastVariant,
  { Icon: React.ElementType; iconColor: string; borderColor: string; bg: string; titleColor: string }
> = {
  success: {
    Icon: CheckCircle2,
    iconColor: "#08A66A",
    borderColor: "#A7F3D0",
    bg: "#ECFDF5",
    titleColor: "#064E3B",
  },
  error: {
    Icon: XCircle,
    iconColor: "#EF4444",
    borderColor: "#FECACA",
    bg: "#FEF2F2",
    titleColor: "#7F1D1D",
  },
  warning: {
    Icon: AlertTriangle,
    iconColor: "#F59E0B",
    borderColor: "#FEF3C7",
    bg: "#FFFBEB",
    titleColor: "#78350F",
  },
  info: {
    Icon: Info,
    iconColor: "#2563EB",
    borderColor: "#BFDBFE",
    bg: "#EFF6FF",
    titleColor: "#1E3A8A",
  },
};

// ── Single Toast Item ──────────────────────────────────────────────────────

function ToastItem({ toast, dismiss }: { toast: Toast; dismiss: (id: string) => void }) {
  const config = variantConfig[toast.variant];
  const duration = toast.duration ?? 5000;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-dismiss
  useEffect(() => {
    timerRef.current = setTimeout(() => dismiss(toast.id), duration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast.id, duration, dismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 60, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      className="w-full max-w-sm pointer-events-auto"
    >
      <div
        className="flex items-start gap-3 rounded-2xl border p-4 shadow-lg shadow-black/8 backdrop-blur-sm"
        style={{
          backgroundColor: config.bg,
          borderColor: config.borderColor,
        }}
      >
        {/* Icon */}
        <div className="shrink-0 mt-0.5">
          <config.Icon className="w-5 h-5" style={{ color: config.iconColor }} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-bold leading-snug"
            style={{ color: config.titleColor }}
          >
            {toast.title}
          </p>
          {toast.description && (
            <p className="text-xs text-[#475569] mt-0.5 leading-relaxed">
              {toast.description}
            </p>
          )}
          {toast.action && (
            <button
              onClick={() => {
                toast.action!.onClick();
                dismiss(toast.id);
              }}
              className="mt-2.5 text-xs font-bold px-3 py-1.5 rounded-lg text-white transition-opacity hover:opacity-90 cursor-pointer"
              style={{ backgroundColor: config.iconColor }}
            >
              {toast.action.label}
            </button>
          )}
        </div>

        {/* Dismiss */}
        <button
          onClick={() => dismiss(toast.id)}
          className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-[#94A3B8] hover:text-[#475569] hover:bg-black/5 transition-colors cursor-pointer mt-0.5"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="mx-4 h-0.5 rounded-full overflow-hidden" style={{ backgroundColor: config.borderColor }}>
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: config.iconColor }}
          initial={{ width: "100%" }}
          animate={{ width: "0%" }}
          transition={{ duration: duration / 1000, ease: "linear" }}
        />
      </div>
    </motion.div>
  );
}

// ── Viewport (fixed position container) ────────────────────────────────────

function ToastViewport({
  toasts,
  dismiss,
}: {
  toasts: Toast[];
  dismiss: (id: string) => void;
}) {
  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 items-end pointer-events-none"
    >
      <AnimatePresence mode="sync">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} dismiss={dismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}
