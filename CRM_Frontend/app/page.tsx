"use client";

import { useTheme } from "@/app/providers";
import { api, isLoggedIn, saveTokens } from "@/lib/api";
import { Button, Card, Input } from "@/components/ui";
import { Eye, EyeOff, Moon, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    const user = username.trim();
    const pass = password;
    if (!user || !pass) {
      setError("Enter username and password");
      setLoading(false);
      return;
    }
    try {
      const tokens = await api.login(user, pass);
      saveTokens(tokens);
      const me = await api.me();
      router.push(me.role === "Admin" ? "/admin" : "/dashboard");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (/no active account|credentials|unauthorized|401/i.test(msg)) {
        setError("Invalid username or password");
      } else if (/failed to fetch|network/i.test(msg)) {
        setError("Cannot reach server. Try again.");
      } else if (msg && msg !== "Request failed") {
        setError(msg);
      } else {
        setError("Invalid username or password");
      }
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
            <label className="mb-1 block text-sm text-slate-600 dark:text-slate-400">Username</label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin / bdm / tl / manager"
              autoComplete="username"
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600 dark:text-slate-400">Password</label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="pr-11"
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
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
