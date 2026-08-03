"use client";

import { LOTTIE, LottieEmbed } from "@/components/lottie-embed";
import { MarketingShell } from "@/components/marketing-shell";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Building2,
  ClipboardCheck,
  MapPin,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import Link from "next/link";

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.08 * i, duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

const FEATURES = [
  {
    icon: Target,
    title: "Lead to order pipeline",
    body: "Capture merchants, follow-ups, and dispositions across every project without spreadsheet chaos.",
  },
  {
    icon: MapPin,
    title: "Field workdesk",
    body: "BDMs onboard with Fresh Direct or existing leads — forms, photos, and visits in one mobile-friendly desk.",
  },
  {
    icon: ClipboardCheck,
    title: "Verification desk",
    body: "Ops and supervisors clear document queues with assignment, SLAs, and an audit trail.",
  },
  {
    icon: Building2,
    title: "Multi-tenant platform",
    body: "Super Admin packages, modules, and trial control — each company only sees what they subscribe to.",
  },
];

const STEPS = [
  { n: "01", title: "Register company", body: "Submit company details and corporate KYC documents online." },
  { n: "02", title: "Super Admin verifies", body: "GST, PAN, incorporation & proofs are reviewed before access." },
  { n: "03", title: "Trial or paid unlock", body: "Approved companies start a 15-day trial or paid package modules." },
  { n: "04", title: "Run field sales", body: "Add teams, publish forms, and close merchants with live dashboards." },
];

export function HomeLanding() {
  return (
    <MarketingShell>
      {/* Hero — full-bleed brand first */}
      <section className="relative min-h-[92vh] overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "linear-gradient(115deg, rgba(11,61,74,0.92) 0%, rgba(11,61,74,0.72) 45%, rgba(232,93,76,0.35) 100%), url(https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=2000&q=80)",
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(232,93,76,0.25),transparent_50%)]" />
        <div className="relative mx-auto flex max-w-6xl flex-col justify-end gap-8 px-4 pb-16 pt-28 sm:px-6 sm:pb-24 sm:pt-32 lg:min-h-[92vh] lg:justify-center lg:pb-20">
          <motion.p
            custom={0}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#F6F3EE]"
          >
            <Sparkles className="h-3.5 w-3.5 text-[#E85D4C]" />
            Sales operations platform
          </motion.p>
          <motion.h1
            custom={1}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="max-w-3xl font-[family-name:var(--font-syne)] text-5xl font-extrabold leading-[0.95] tracking-tight text-white sm:text-6xl lg:text-7xl"
          >
            Trackbook CRM
          </motion.h1>
          <motion.p
            custom={2}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="max-w-xl text-lg text-white/85 sm:text-xl"
          >
            Field teams, verification desks, and company admins — aligned on one multi-project CRM built for Indian sales ops.
          </motion.p>
          <motion.div
            custom={3}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="flex flex-wrap items-center gap-3"
          >
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-full bg-[#E85D4C] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-[#E85D4C]/30 transition hover:bg-[#D54C3C]"
            >
              Register your company <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/10 px-6 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20"
            >
              Sign in
            </Link>
          </motion.div>
          <motion.div
            custom={4}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="pointer-events-none absolute bottom-6 right-4 hidden w-56 sm:bottom-10 sm:right-8 lg:block lg:w-72"
          >
            <LottieEmbed src={LOTTIE.rocket} className="opacity-90" />
          </motion.div>
        </div>
      </section>

      {/* Product */}
      <section id="product" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#E85D4C]">Why Trackbook CRM</p>
            <h2 className="mt-2 font-[family-name:var(--font-syne)] text-3xl font-extrabold text-[#0B3D4A] sm:text-4xl">
              Built for BDMs, TLs, Ops — and the Super Admin who runs the platform
            </h2>
            <p className="mt-4 text-[#14212B]/75">
              From Fresh Direct onboarding to package-based module unlocks, every page is designed for real field velocity and clean HQ control.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {FEATURES.map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ delay: i * 0.06 }}
                  className="rounded-2xl border border-[#0B3D4A]/10 bg-white/70 p-4"
                >
                  <f.icon className="h-5 w-5 text-[#0B3D4A]" />
                  <p className="mt-2 font-bold text-[#14212B]">{f.title}</p>
                  <p className="mt-1 text-sm text-[#14212B]/65">{f.body}</p>
                </motion.div>
              ))}
            </div>
          </div>
          <div className="relative overflow-hidden rounded-[2rem] border border-[#0B3D4A]/10 bg-gradient-to-br from-[#0B3D4A] to-[#163E4A] p-6 shadow-xl">
            <LottieEmbed src={LOTTIE.analytics} className="mx-auto h-64 w-full max-w-md" />
            <p className="mt-2 text-center text-sm font-semibold text-white/90">Live KPIs · Forms · Visits · Verification</p>
          </div>
        </div>
      </section>

      {/* Workflow */}
      <section id="workflow" className="bg-[#0B3D4A] py-20 text-[#F6F3EE]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#E85D4C]">Company onboarding</p>
            <h2 className="mt-2 font-[family-name:var(--font-syne)] text-3xl font-extrabold sm:text-4xl">
              Documents first. Access after Super Admin verification.
            </h2>
            <p className="mt-3 text-[#F6F3EE]/75">
              New companies wait for corporate KYC review — GST, PAN, incorporation, and proofs — before trial or paid CRM access unlocks.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="rounded-2xl border border-white/15 bg-white/5 p-5 backdrop-blur"
              >
                <p className="font-[family-name:var(--font-syne)] text-2xl font-extrabold text-[#E85D4C]">{s.n}</p>
                <p className="mt-2 text-lg font-bold">{s.title}</p>
                <p className="mt-1 text-sm text-[#F6F3EE]/70">{s.body}</p>
              </motion.div>
            ))}
          </div>
          <div className="mt-12 flex flex-wrap items-center justify-between gap-6 rounded-3xl border border-white/15 bg-white/5 p-6">
            <div className="flex items-center gap-4">
              <div className="h-24 w-24 shrink-0">
                <LottieEmbed src={LOTTIE.secure} />
              </div>
              <div>
                <p className="font-bold">Trust & compliance ready</p>
                <p className="text-sm text-[#F6F3EE]/70">Privacy, terms, and disclaimers published. Document audit for every tenant.</p>
              </div>
            </div>
            <Link href="/register" className="rounded-full bg-[#E85D4C] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#D54C3C]">
              Start registration
            </Link>
          </div>
        </div>
      </section>

      {/* Security / packages teaser */}
      <section id="security" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#E85D4C]">Platform control</p>
            <h2 className="mt-2 font-[family-name:var(--font-syne)] text-3xl font-extrabold text-[#0B3D4A] sm:text-4xl">
              Packages, modules, and 15-day trials — Super Admin decides
            </h2>
            <ul className="mt-6 space-y-3 text-[#14212B]/80">
              {[
                "Default common modules enabled for new companies",
                "Upgrade packages unlock pipeline, targets, audit & more",
                "Manual trial +/− days and payment unlock after subscribe",
                "Role permissions inside each company stay Admin-managed",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#0B3D4A]" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="overflow-hidden rounded-[2rem] border border-[#0B3D4A]/10 bg-white shadow-lg">
            <img
              src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=1200&q=80"
              alt="Sales team collaborating"
              className="h-56 w-full object-cover sm:h-72"
            />
            <div className="flex items-center gap-3 p-5">
              <Users className="h-5 w-5 text-[#E85D4C]" />
              <p className="text-sm font-semibold text-[#14212B]">Managers, TLs, BDMs & Ops — one hierarchy, clear pages.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-[#0B3D4A]/10 bg-gradient-to-br from-[#F6F3EE] via-white to-[#E8F2F4] px-4 py-16 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 rounded-[2rem] border border-[#0B3D4A]/10 bg-[#14212B] p-8 text-white sm:flex-row sm:items-center sm:p-10">
          <div className="max-w-xl">
            <h2 className="font-[family-name:var(--font-syne)] text-3xl font-extrabold">Ready to put your field team on Trackbook?</h2>
            <p className="mt-2 text-white/70">Register, upload corporate docs, and wait for Super Admin verification — then go live.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/register" className="rounded-full bg-[#E85D4C] px-6 py-3 text-sm font-bold hover:bg-[#D54C3C]">
              Register company
            </Link>
            <Link href="/terms" className="rounded-full border border-white/30 px-6 py-3 text-sm font-bold hover:bg-white/10">
              Read terms
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
