"use client";

import { api } from "@/lib/api";
import { canAccessPage, homeHrefForUser, type AppRole } from "@/lib/nav-catalog";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

type Role = AppRole;

export function RequireRole({
  roles,
  children,
  fallbackHref = "/dashboard",
}: {
  roles: Role[];
  children: ReactNode;
  fallbackHref?: string;
}) {
  const router = useRouter();
  const { data: me, isLoading, isError } = useQuery({ queryKey: ["me"], queryFn: api.me, retry: false });

  useEffect(() => {
    if (isError) router.replace("/");
  }, [isError, router]);

  useEffect(() => {
    if (!me) return;
    if (!roles.includes(me.role as Role)) {
      router.replace(me.role === "Admin" ? "/admin" : homeHrefForUser(me.role as Role, me.allowed_pages) || fallbackHref);
    }
  }, [me, roles, router, fallbackHref]);

  if (isLoading || !me) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
      </div>
    );
  }

  if (!roles.includes(me.role as Role)) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center dark:border-rose-500/30 dark:bg-rose-500/10">
        <ShieldAlert className="mx-auto h-8 w-8 text-rose-500" />
        <h2 className="mt-3 text-lg font-bold text-slate-900 dark:text-slate-50">Access denied</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          This panel is only available for: {roles.join(", ")}.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

/** Gate a field page using Admin-managed allowed_pages */
export function RequirePage({
  pageKey,
  children,
}: {
  pageKey: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const { data: me, isLoading, isError } = useQuery({ queryKey: ["me"], queryFn: api.me, retry: false });

  useEffect(() => {
    if (isError) router.replace("/");
  }, [isError, router]);

  useEffect(() => {
    if (!me) return;
    const role = me.role as Role;
    if (!canAccessPage(role, pageKey, me.allowed_pages)) {
      router.replace(homeHrefForUser(role, me.allowed_pages));
    }
  }, [me, pageKey, router]);

  if (isLoading || !me) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
      </div>
    );
  }

  if (!canAccessPage(me.role as Role, pageKey, me.allowed_pages)) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center dark:border-amber-500/30 dark:bg-amber-500/10">
        <ShieldAlert className="mx-auto h-8 w-8 text-amber-500" />
        <h2 className="mt-3 text-lg font-bold text-slate-900 dark:text-slate-50">Page locked</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Your Admin has not enabled this page for the {me.role} role.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
