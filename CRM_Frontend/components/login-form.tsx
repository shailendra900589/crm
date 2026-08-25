"use client";

import { useTheme } from "@/app/providers";
import { BrandLogo } from "@/components/brand-logo";
import { Button, Card, Input } from "@/components/ui";
import { api, isLoggedIn, saveTokens } from "@/lib/api";
import { homeHrefForUser } from "@/lib/nav-catalog";
import { Eye, EyeOff, Moon, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Mode = "login" | "forgot" | "reset";

export function LoginFormView() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailHint, setEmailHint] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) return;
    api.me()
      .then((user) => router.replace(homeHrefForUser(user.role, user.allowed_pages)))
      .catch(() => {});
  }, [router]);

  const resetMessages = () => {
    setError("");
    setInfo("");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    resetMessages();
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
      router.push(homeHrefForUser(me.role, me.allowed_pages));
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

  const handleForgotRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    resetMessages();
    const ident = username.trim();
    if (!ident) {
      setError("Enter your username or email");
      setLoading(false);
      return;
    }
    try {
      const data = await api.forgotPassword(ident);
      setEmailHint(data.email_hint || "");
      setInfo(
        data.email_hint
          ? `OTP sent to ${data.email_hint}. Check inbox / spam.`
          : data.detail || "If an account exists, an OTP has been sent.",
      );
      setMode("reset");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    resetMessages();
    if (!username.trim() || !otp.trim()) {
      setError("Enter OTP from your email");
      setLoading(false);
      return;
    }
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters");
      setLoading(false);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }
    try {
      const data = await api.resetPassword({
        identifier: username.trim(),
        otp: otp.trim(),
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setInfo(data.detail || "Password updated. Sign in with your new password.");
      setPassword("");
      setOtp("");
      setNewPassword("");
      setConfirmPassword("");
      setMode("login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password reset failed");
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
        <div className="mb-6 flex flex-col items-center text-center">
          <BrandLogo size={72} priority />
          <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-slate-50">Trackbook CRM</h1>
          <p className="mt-1 text-sm text-slate-500">
            {mode === "login" && "Sign in to your account"}
            {mode === "forgot" && "Reset password — we will email an OTP"}
            {mode === "reset" && "Enter OTP and choose a new password"}
          </p>
        </div>

        {mode === "login" && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-slate-600 dark:text-slate-400">Username</label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Rahul / admin / email"
                autoComplete="username"
                autoFocus
              />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="block text-sm text-slate-600 dark:text-slate-400">Password</label>
                <button
                  type="button"
                  className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-300"
                  onClick={() => {
                    resetMessages();
                    setMode("forgot");
                  }}
                >
                  Forgot password?
                </button>
              </div>
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
            {info && <p className="text-sm text-emerald-600">{info}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        )}

        {mode === "forgot" && (
          <form onSubmit={handleForgotRequest} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-slate-600 dark:text-slate-400">
                Username or email
              </label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="your username or work email"
                autoComplete="username"
                autoFocus
              />
            </div>
            {error && <p className="text-sm text-rose-500">{error}</p>}
            {info && <p className="text-sm text-emerald-600">{info}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending OTP…" : "Send OTP"}
            </Button>
            <button
              type="button"
              className="w-full text-center text-sm font-semibold text-slate-600 hover:underline dark:text-slate-300"
              onClick={() => {
                resetMessages();
                setMode("login");
              }}
            >
              Back to sign in
            </button>
          </form>
        )}

        {mode === "reset" && (
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-slate-600 dark:text-slate-400">
                Username or email
              </label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-600 dark:text-slate-400">
                OTP {emailHint ? `(sent to ${emailHint})` : ""}
              </label>
              <Input
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="6-digit code"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-600 dark:text-slate-400">New password</label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-600 dark:text-slate-400">
                Confirm password
              </label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            {error && <p className="text-sm text-rose-500">{error}</p>}
            {info && <p className="text-sm text-emerald-600">{info}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Updating…" : "Reset password"}
            </Button>
            <div className="flex justify-between gap-2 text-sm">
              <button
                type="button"
                className="font-semibold text-blue-600 hover:underline dark:text-blue-300"
                onClick={() => {
                  resetMessages();
                  setMode("forgot");
                }}
              >
                Resend OTP
              </button>
              <button
                type="button"
                className="font-semibold text-slate-600 hover:underline dark:text-slate-300"
                onClick={() => {
                  resetMessages();
                  setMode("login");
                }}
              >
                Back to sign in
              </button>
            </div>
          </form>
        )}

        <p className="mt-4 text-center text-xs text-slate-500">
          New company?{" "}
          <a href="/register" className="font-semibold text-blue-600 hover:underline dark:text-blue-300">
            Register here
          </a>
          {" · "}
          <a href="/" className="font-semibold text-slate-600 hover:underline dark:text-slate-300">
            Home
          </a>
        </p>
      </Card>
    </div>
  );
}
