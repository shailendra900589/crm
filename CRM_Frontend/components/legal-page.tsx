"use client";

import { MarketingShell } from "@/components/marketing-shell";
import Link from "next/link";
import type { ReactNode } from "react";

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#E85D4C]">Legal</p>
        <h1 className="mt-2 font-[family-name:var(--font-syne)] text-4xl font-extrabold text-[#0B3D4A]">{title}</h1>
        <p className="mt-2 text-sm text-[#14212B]/55">Last updated: {updated}</p>
        <article className="prose-legal mt-8 space-y-5 text-[15px] leading-relaxed text-[#14212B]/85">
          {children}
        </article>
        <p className="mt-10 text-sm text-[#14212B]/60">
          Questions? Contact your Super Admin or reach us via your registered company email.{" "}
          <Link href="/" className="font-semibold text-[#0B3D4A] underline">
            Back to home
          </Link>
        </p>
      </div>
    </MarketingShell>
  );
}

export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-[family-name:var(--font-syne)] text-xl font-bold text-[#0B3D4A]">{heading}</h2>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}
