"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { motion, useSpring, useTransform } from "framer-motion";
import { X } from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

export function Button({
  className,
  variant = "default",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant }), className)} {...props} />;
}

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-blue-600 text-white hover:bg-blue-700 shadow-sm",
        outline: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800",
        ghost: "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
        danger: "bg-rose-500 text-white hover:bg-rose-600",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { onClick, onMouseEnter, onMouseLeave, id, role, tabIndex, style } = props;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn("rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900", className)}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      id={id}
      role={role}
      tabIndex={tabIndex}
      style={style}
    >
      {children}
    </motion.div>
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100",
        className
      )}
      {...props}
    />
  );
}

export function Badge({ status, label }: { status: string; label: string }) {
  const colors: Record<string, string> = {
    order_confirmed: "bg-emerald-100 text-emerald-700",
    interested: "bg-blue-100 text-blue-700",
    follow_up: "bg-amber-100 text-amber-700",
    not_interested: "bg-rose-100 text-rose-700",
    callback: "bg-violet-100 text-violet-700",
    pending: "bg-amber-100 text-amber-700",
    approved: "bg-emerald-100 text-emerald-700",
    rejected: "bg-rose-100 text-rose-700",
  };
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", colors[status] || "bg-slate-100 text-slate-600")}>
      {label}
    </span>
  );
}

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30 backdrop-blur-sm">
      <div className="h-full w-full max-w-lg overflow-y-auto border-l border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition",
            active === t.id
              ? "bg-white text-blue-600 shadow-sm dark:bg-slate-900 dark:text-blue-300"
              : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  accent,
  pulse,
  icon: Icon,
  hint,
  variant = "slate",
}: {
  label: string;
  value: string | number;
  accent?: string;
  pulse?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  hint?: string;
  variant?: "slate" | "violet" | "blue" | "amber" | "emerald";
}) {
  const numeric = typeof value === "number" ? value : parseFloat(String(value).replace("%", ""));
  const isNum = !Number.isNaN(numeric) && typeof value === "number";
  const spring = useSpring(0, { stiffness: 80, damping: 20 });
  const display = useTransform(spring, (v) => (String(value).includes("%") ? `${Math.round(v)}%` : String(Math.round(v))));

  useEffect(() => {
    if (isNum) spring.set(numeric);
  }, [isNum, numeric, spring]);

  const styles: Record<string, { bg: string; icon: string; ring: string }> = {
    slate: { bg: "from-slate-50 to-white dark:from-slate-900 dark:to-slate-900", icon: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300", ring: "ring-slate-200" },
    violet: { bg: "from-violet-50 to-white dark:from-violet-950/40 dark:to-slate-900", icon: "bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-300", ring: "ring-violet-100" },
    blue: { bg: "from-blue-50 to-white dark:from-blue-950/40 dark:to-slate-900", icon: "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-300", ring: "ring-blue-100" },
    amber: { bg: "from-amber-50 to-white dark:from-amber-950/40 dark:to-slate-900", icon: "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-300", ring: "ring-amber-100" },
    emerald: { bg: "from-emerald-50 to-white dark:from-emerald-950/40 dark:to-slate-900", icon: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300", ring: "ring-emerald-100" },
  };
  const style = styles[variant];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br p-5 shadow-sm dark:border-slate-700",
        style.bg,
        pulse && "ring-2 ring-violet-200 ring-offset-1 dark:ring-violet-500/40 dark:ring-offset-slate-950"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
          {isNum ? (
            <motion.p className={cn("mt-2 text-3xl font-bold tracking-tight", accent || "text-slate-900")}>{display}</motion.p>
          ) : (
            <p className={cn("mt-2 text-3xl font-bold tracking-tight", accent || "text-slate-900")}>{value}</p>
          )}
          {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
        </div>
        {Icon && (
          <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", style.icon)}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
      <div className={cn("absolute -bottom-6 -right-6 h-24 w-24 rounded-full opacity-40 blur-2xl", style.ring.replace("ring-", "bg-"))} />
    </motion.div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800", className)} />;
}
