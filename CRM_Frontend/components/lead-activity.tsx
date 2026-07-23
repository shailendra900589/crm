"use client";

import { api, type LeadActivityEvent } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarClock,
  ClipboardList,
  FileText,
  MessageSquare,
  Phone,
  Sparkles,
  Upload,
} from "lucide-react";

const ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  lead_created: Sparkles,
  visit: CalendarClock,
  form: FileText,
  document: Upload,
  note: MessageSquare,
  call: Phone,
};

const COLOR: Record<string, string> = {
  lead_created: "bg-indigo-100 text-indigo-600",
  visit: "bg-blue-100 text-blue-600",
  form: "bg-violet-100 text-violet-600",
  document: "bg-amber-100 text-amber-700",
  note: "bg-emerald-100 text-emerald-700",
  call: "bg-sky-100 text-sky-700",
};

export function LeadActivityTimeline({ leadId }: { leadId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ["lead-activity", leadId],
    queryFn: () => api.leadActivity(leadId),
  });

  if (isLoading) {
    return <p className="py-8 text-center text-sm text-slate-400">Loading activity...</p>;
  }

  const events = data?.events || [];
  if (!events.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
        <ClipboardList className="mx-auto h-8 w-8 text-slate-300" />
        <p className="mt-2 text-sm text-slate-400">No activity yet for this lead</p>
      </div>
    );
  }

  return (
    <div className="relative space-y-0 pl-2">
      <div className="absolute bottom-2 left-[1.15rem] top-2 w-px bg-slate-200" />
      {events.map((ev) => (
        <TimelineItem key={ev.id} event={ev} />
      ))}
    </div>
  );
}

function TimelineItem({ event }: { event: LeadActivityEvent }) {
  const Icon = ICON[event.type] || ClipboardList;
  const color = COLOR[event.type] || "bg-slate-100 text-slate-600";
  const when = new Date(event.at);

  return (
    <div className="relative flex gap-3 pb-5">
      <div className={cn("relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="text-sm font-semibold text-slate-900">{event.title}</p>
          <time className="text-[11px] text-slate-400">
            {Number.isNaN(when.getTime())
              ? event.at
              : when.toLocaleString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
          </time>
        </div>
        {event.detail && <p className="mt-1 text-sm text-slate-600">{event.detail}</p>}
        <p className="mt-1.5 text-xs text-slate-400">by {event.actor}</p>
      </div>
    </div>
  );
}
