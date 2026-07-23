"use client";

import { Button, Input } from "@/components/ui";
import { type CallOutcome } from "@/lib/api";
import { useState } from "react";

export const CALL_OUTCOMES: { value: CallOutcome; label: string }[] = [
  { value: "answered", label: "Answered" },
  { value: "no_answer", label: "No answer" },
  { value: "busy", label: "Busy / Switched off" },
  { value: "callback", label: "Callback requested" },
  { value: "interested", label: "Interested" },
  { value: "not_interested", label: "Not interested" },
];

export function LogCallForm({
  onSubmit,
  onCancel,
  saving,
  defaultFollowUpDate = "",
}: {
  onSubmit: (data: { outcome: CallOutcome; notes: string; follow_up_date?: string }) => void;
  onCancel: () => void;
  saving?: boolean;
  defaultFollowUpDate?: string;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [outcome, setOutcome] = useState<CallOutcome>("answered");
  const [notes, setNotes] = useState("");
  const [followUpDate, setFollowUpDate] = useState(defaultFollowUpDate);

  const showFollowUp = outcome === "callback" || outcome === "no_answer" || outcome === "busy";

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Call outcome</label>
        <select
          value={outcome}
          onChange={(e) => setOutcome(e.target.value as CallOutcome)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
        >
          {CALL_OUTCOMES.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      {showFollowUp && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Next follow-up</label>
          <Input type="date" value={followUpDate} min={today} onChange={(e) => setFollowUpDate(e.target.value)} />
        </div>
      )}
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Notes</label>
        <textarea
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
          rows={3}
          placeholder="What was discussed..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      <div className="flex gap-2 pt-1">
        <Button
          onClick={() => onSubmit({
            outcome,
            notes,
            follow_up_date: showFollowUp && followUpDate ? followUpDate : undefined,
          })}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save call log"}
        </Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
