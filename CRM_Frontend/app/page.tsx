"use client";

import { useTheme } from "@/app/providers";
import { api, isLoggedIn, saveTokens } from "@/lib/api";
import { Button, Card, Input } from "@/components/ui";
import { Moon, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [username, setUsername] = useState("bdm");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) return;
    api.me()
      .then((user) => router.replace(user.role === "Admin" ? "/admin" : "/dashboard"))
      .catch(() => {});
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const tokens = await api.login(username, password);
      saveTokens(tokens);
      const user = await api.me();
      router.push(user.role === "Admin" ? "/admin" : "/dashboard");
    } catch {
      setError("Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <button
        type="button"
        aria-label="Toggle theme"
        onClick={toggleTheme}
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      >
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
      <Card className="w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Sales CRM</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-50">Multi-Project CRM</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to your account</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-slate-600">Username</label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin / bdm / tl / manager" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">Password</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p className="text-sm text-rose-500">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-400">
          Demo: admin / manager / tl / bdm — password123
        </p>
      </Card>
    </div>
  );
}
