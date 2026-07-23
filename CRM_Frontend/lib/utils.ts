import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const STATUS_COLORS: Record<string, string> = {
  order_confirmed: "bg-emerald-100 text-emerald-700",
  interested: "bg-blue-100 text-blue-700",
  follow_up: "bg-amber-100 text-amber-700",
  not_interested: "bg-rose-100 text-rose-700",
  callback: "bg-violet-100 text-violet-700",
};
