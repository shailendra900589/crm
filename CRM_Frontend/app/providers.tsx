"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { api, isLoggedIn } from "@/lib/api";

type Theme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  toggleTheme: () => undefined,
  setTheme: () => undefined,
});

export function useTheme() {
  return useContext(ThemeContext);
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem("theme", theme);
}

/**
 * When HRMS / mobile opens CRM with ?trackbook_sso=..., exchange ticket for JWT
 * before the authenticated shell mounts.
 */
function TrackbookSsoBootstrap({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (typeof window === "undefined") return;
        const sp = new URLSearchParams(window.location.search);
        const ticket = (sp.get("trackbook_sso") || sp.get("ticket") || "").trim();
        if (ticket) {
          try {
            await api.loginWithTrackbookSso(ticket);
          } catch (e) {
            console.warn("Trackbook SSO failed", e);
          }
          sp.delete("trackbook_sso");
          sp.delete("ticket");
          const next = `${window.location.pathname}${sp.toString() ? `?${sp}` : ""}${window.location.hash || ""}`;
          window.history.replaceState({}, "", next);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-300">
        {isLoggedIn() ? "Loading CRM…" : "Signing in with Trackbook…"}
      </div>
    );
  }
  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    const saved = localStorage.getItem("theme") as Theme | null;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const next: Theme = saved === "dark" || saved === "light" ? saved : prefersDark ? "dark" : "light";
    setThemeState(next);
    applyTheme(next);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyTheme(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      applyTheme(next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      <QueryClientProvider client={client}>
        <TrackbookSsoBootstrap>{children}</TrackbookSsoBootstrap>
      </QueryClientProvider>
    </ThemeContext.Provider>
  );
}
