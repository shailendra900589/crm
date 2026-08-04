"use client";

import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";
import { DM_Sans, Syne } from "next/font/google";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

const syne = Syne({ subsets: ["latin"], variable: "--font-syne", weight: ["600", "700", "800"] });
const dm = DM_Sans({ subsets: ["latin"], variable: "--font-dm", weight: ["400", "500", "600", "700"] });

const NAV = [
  { href: "/#product", label: "Product" },
  { href: "/#workflow", label: "Workflow" },
  { href: "/#security", label: "Security" },
  { href: "/register", label: "Register" },
];

export function MarketingShell({ children, className }: { children: ReactNode; className?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div
      className={cn(
        syne.variable,
        dm.variable,
        "min-h-screen bg-[#F6F3EE] text-[#14212B] antialiased",
        "font-[family-name:var(--font-dm)]",
        className,
      )}
    >
      <header className="sticky top-0 z-40 border-b border-[#14212B]/10 bg-[#F6F3EE]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="inline-flex items-center">
            <BrandLogo size={36} showText priority />
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "text-sm font-semibold text-[#14212B]/70 transition hover:text-[#0B3D4A]",
                  pathname === n.href && "text-[#0B3D4A]",
                )}
              >
                {n.label}
              </Link>
            ))}
            <Link
              href="/login"
              className="rounded-full bg-[#0B3D4A] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0E4F5F]"
            >
              Sign in
            </Link>
          </nav>
          <button
            type="button"
            className="rounded-lg border border-[#14212B]/15 p-2 md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {open && (
          <div className="border-t border-[#14212B]/10 px-4 py-3 md:hidden">
            <div className="flex flex-col gap-2">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="rounded-lg px-2 py-2 text-sm font-semibold" onClick={() => setOpen(false)}>
                  {n.label}
                </Link>
              ))}
              <Link href="/login" className="rounded-lg bg-[#0B3D4A] px-3 py-2 text-center text-sm font-semibold text-white" onClick={() => setOpen(false)}>
                Sign in
              </Link>
            </div>
          </div>
        )}
      </header>
      <main>{children}</main>
      <footer className="border-t border-[#14212B]/10 bg-[#0B3D4A] text-[#F6F3EE]">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
          <div>
            <BrandLogo size={40} showText textClassName="text-[#F6F3EE]" />
            <p className="mt-2 max-w-sm text-sm text-[#F6F3EE]/75">
              Multi-project sales CRM for field teams — leads, visits, verification, and org control under one roof.
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#E85D4C]">Product</p>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              <Link href="/#workflow" className="hover:underline">Onboarding workflow</Link>
              <Link href="/register" className="hover:underline">Register company</Link>
              <Link href="/login" className="hover:underline">Sign in</Link>
            </div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#E85D4C]">Legal</p>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
              <Link href="/terms" className="hover:underline">Terms & Conditions</Link>
              <Link href="/disclaimer" className="hover:underline">Disclaimers</Link>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 px-4 py-4 text-center text-xs text-[#F6F3EE]/60">
          © {new Date().getFullYear()} Trackbook CRM. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
