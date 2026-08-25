"use client";

import { MarketingShell } from "@/components/marketing-shell";
import { Button, Input } from "@/components/ui";
import { api, clearTokens } from "@/lib/api";
import { useMutation } from "@tanstack/react-query";
import { Building2, FileUp } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const DOC_FIELDS: { key: string; label: string; hint: string }[] = [
  { key: "gst_certificate", label: "GST certificate", hint: "PDF / image" },
  { key: "pan_card", label: "Company PAN", hint: "PDF / image" },
  { key: "incorporation", label: "Certificate of incorporation", hint: "PDF / image" },
  { key: "address_proof", label: "Address proof", hint: "Optional" },
  { key: "cancelled_cheque", label: "Cancelled cheque", hint: "Optional" },
];

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
    accept_terms: false,
  });
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [done, setDone] = useState(false);

  // Stale JWTs in localStorage make public register fail with JWT auth errors.
  useEffect(() => {
    clearTokens();
  }, []);

  const register = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (typeof v === "boolean") fd.append(k, v ? "true" : "false");
        else fd.append(k, String(v));
      });
      Object.entries(files).forEach(([k, f]) => {
        if (f) fd.append(k, f);
      });
      return api.registerOrganizationForm(fd);
    },
    onSuccess: () => setDone(true),
  });

  const hasRequiredDocs = !!(files.gst_certificate && files.pan_card);

  if (done) {
    return (
      <MarketingShell>
        <div className="mx-auto max-w-md px-4 py-20">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
            <Building2 className="mx-auto h-10 w-10 text-emerald-600" />
            <h1 className="mt-3 text-xl font-bold text-emerald-900">Registration received</h1>
            <p className="mt-2 text-sm text-emerald-800">
              Super Admin will verify your corporate documents first. After verification you can be approved for trial
              or paid access — then your team can work in the CRM.
            </p>
            <Link href="/login" className="mt-5 inline-block text-sm font-semibold text-emerald-700 underline">
              Back to login
            </Link>
          </div>
        </div>
      </MarketingShell>
    );
  }

  return (
    <MarketingShell>
      <div className="mx-auto max-w-2xl space-y-5 px-4 py-12 sm:px-6">
        <div className="rounded-2xl bg-gradient-to-br from-[#0B3D4A] to-[#163E4A] p-6 text-white">
          <div className="mb-3 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/trackbook-crm.png" alt="Trackbook CRM" width={48} height={48} className="rounded-xl" />
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/70">Trackbook CRM</p>
          </div>
          <h1 className="font-[family-name:var(--font-syne)] text-2xl font-extrabold">Register your company</h1>
          <p className="mt-1 text-sm text-white/80">
            Upload corporate KYC documents. Super Admin verifies them before CRM access is enabled.
          </p>
        </div>

        <div className="space-y-3 rounded-2xl border border-[#0B3D4A]/10 bg-white p-5 shadow-sm">
          {(
            [
              ["company_name", "Company name *"],
              ["email", "Work email *"],
              ["phone", "Phone"],
              ["city", "City"],
              ["admin_name", "Admin full name"],
              ["username", "Login username *"],
              ["password", "Password *"],
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

          <div className="rounded-xl border border-dashed border-[#0B3D4A]/25 bg-[#F6F3EE]/80 p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-[#0B3D4A]">
              <FileUp className="h-4 w-4" /> Corporate documents
            </p>
            <p className="mt-1 text-xs text-slate-500">GST + PAN required. PDF or image, max ~10MB each.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {DOC_FIELDS.map((d) => (
                <label key={d.key} className="block text-xs">
                  <span className="font-semibold text-slate-600">
                    {d.label} {d.key === "gst_certificate" || d.key === "pan_card" ? "*" : ""}
                  </span>
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    className="mt-1 block w-full text-xs"
                    onChange={(e) => setFiles((f) => ({ ...f, [d.key]: e.target.files?.[0] || null }))}
                  />
                  <span className="text-[10px] text-slate-400">{d.hint}</span>
                </label>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={form.trial}
              onChange={(e) => setForm({ ...form, trial: e.target.checked })}
            />
            Request free trial after document verification
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              className="mt-1"
              checked={form.accept_terms}
              onChange={(e) => setForm({ ...form, accept_terms: e.target.checked })}
            />
            <span>
              I accept the{" "}
              <Link href="/terms" className="font-semibold text-[#0B3D4A] underline" target="_blank">
                Terms
              </Link>
              ,{" "}
              <Link href="/privacy" className="font-semibold text-[#0B3D4A] underline" target="_blank">
                Privacy Policy
              </Link>{" "}
              and{" "}
              <Link href="/disclaimer" className="font-semibold text-[#0B3D4A] underline" target="_blank">
                Disclaimers
              </Link>
              .
            </span>
          </label>

          {register.isError && (
            <p className="text-sm text-rose-600">{(register.error as Error).message}</p>
          )}
          <Button
            className="w-full bg-[#0B3D4A] hover:bg-[#0E4F5F]"
            disabled={
              register.isPending ||
              !form.company_name ||
              !form.username ||
              !form.password ||
              !form.email ||
              !form.accept_terms ||
              !hasRequiredDocs
            }
            onClick={() => register.mutate()}
          >
            {register.isPending ? "Submitting…" : "Submit for verification"}
          </Button>
          <p className="text-center text-xs text-slate-400">
            Already have access?{" "}
            <Link href="/login" className="font-semibold text-[#0B3D4A]">
              Login
            </Link>
          </p>
        </div>
      </div>
    </MarketingShell>
  );
}
