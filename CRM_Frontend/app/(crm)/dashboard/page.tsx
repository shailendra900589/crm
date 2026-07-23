"use client";

import { DashboardView } from "@/components/dashboard";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardPage() {
  const router = useRouter();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: api.me });

  useEffect(() => {
    if (me?.role === "Admin") router.replace("/admin");
  }, [me, router]);

  if (me?.role === "Admin") {
    return <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />;
  }

  return <DashboardView />;
}
