"use client";

import { useLiveDashboard } from "@/lib/ws";
import { createContext, useContext } from "react";

const LiveContext = createContext({ pulse: false });

export function LiveSyncProvider({
  scope,
  children,
}: {
  scope: string;
  children: React.ReactNode;
}) {
  const { pulse } = useLiveDashboard(scope);
  return <LiveContext.Provider value={{ pulse }}>{children}</LiveContext.Provider>;
}

export function useLivePulse() {
  return useContext(LiveContext);
}

export function liveScopeForRole(role?: string) {
  if (role === "Admin") return "admin";
  if (role === "Manager" || role === "TL") return "manager";
  return "bdm";
}
