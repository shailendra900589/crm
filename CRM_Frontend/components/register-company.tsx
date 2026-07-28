"use client";

import { Button, Input } from "@/components/ui";
import { api } from "@/lib/api";
import { useMutation } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function RegisterCompanyView() {
  const [form, setForm] = useState({
    company_name: "",
    email: "",
    phone: "",
    city: "",
    admin_name: "",
    username: "",
    password: "",
    trial: true,
  });
  const [done, setDone] = useState(false);

  const register = useMutation({
    mutationFn: () => api.registerOrganization(form),
    onSuccess: () => setDone(true),
  });

  if (done) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <Building2 className="mx-auto h-10 w-10 text-emerald-600" />
        <h1 className="mt-3 text-xl font-bold text-emerald-900">Registration received</h1>
        <p className="mt-2 text-sm text-emerald-800">
          Super Admin will approve your company and enable Trial or Paid access. You can then add employees manually or sync from HRMS.
        </p>
        <Link href="/login" className="mt-5 inline-block text-sm font-semibold text-emerald-700 underline">
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 to-blue-950 p-6 text-white">
        <h1 className="text-2xl font-bold">Register your company</h1>
        <p className="mt-1 text-sm text-slate-300">
          Not connected to HRMS yet? Create a CRM company, wait for Super Admin approval, then start trial or payment.
        </p>
      </div>
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        {(
          [
            ["company_name", "Company name"],
            ["email", "Work email"],
            ["phone", "Phone"],
            ["city", "City"],
            ["admin_name", "Admin full name"],
            ["username", "Login username"],
            ["password", "Password"],
          ] as const
        ).map(([key, label]) => (
          <div key={key}>
            <p className="mb-1 text-[11px] font-semibold text-slate-500">{label}</p>
            <Input
              type={key === "password" ? "password" : key === "email" ? "email" : "text"}
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            />
          </div>
        ))}
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={form.trial}
            onChange={(e) => setForm({ ...form, trial: e.target.checked })}
          />
          Request free trial (Super Admin confirms)
        </label>
        {register.isError && (
          <p className="text-sm text-rose-600">{(register.error as Error).message}</p>
        )}
        <Button
          className="w-full"
          disabled={register.isPending || !form.company_name || !form.username || !form.password}
          onClick={() => register.mutate()}
        >
          {register.isPending ? "Submitting…" : "Submit registration"}
        </Button>
        <p className="text-center text-xs text-slate-400">
          Already have access? <Link href="/login" className="font-semibold text-blue-600">Login</Link>
        </p>
      </div>
    </div>
  );
}
