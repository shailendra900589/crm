"use client";

import { api, getProjectId } from "@/lib/api";
import { Button, Card } from "@/components/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, Upload } from "lucide-react";
import { useState } from "react";

export function BulkUpload() {
  const pid = Number(getProjectId());
  const [jobId, setJobId] = useState<number | null>(null);

  const upload = useMutation({
    mutationFn: (file: File) => api.bulkUpload(pid, file),
    onSuccess: (job) => setJobId(job.id),
  });

  const { data: job } = useQuery({
    queryKey: ["bulk-job", jobId],
    queryFn: () => api.bulkJob(jobId!),
    enabled: !!jobId,
    refetchInterval: jobId ? 2000 : false,
  });

  if (!pid) return null;

  return (
    <Card>
      <h3 className="mb-3 font-semibold text-slate-900">Bulk Lead Upload</h3>
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" className="gap-2" onClick={() => api.downloadBulkTemplate(pid)}>
          <Download className="h-4 w-4" /> Download Template
        </Button>
        <label className="crm-btn-outline cursor-pointer gap-2">
          <Upload className="h-4 w-4" /> Upload Excel
          <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload.mutate(f);
          }} />
        </label>
      </div>
      {job && (
        <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm">
          <p>Status: <strong>{job.status}</strong></p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-blue-600 transition-all duration-500"
              style={{ width: `${job.total_rows ? (job.success_rows / job.total_rows) * 100 : 0}%` }}
            />
          </div>
          <p className="mt-2">Processed: {job.success_rows} / {job.total_rows}</p>
          {job.error_log?.length > 0 && (
            <ul className="mt-2 text-xs text-rose-600">
              {job.error_log.slice(0, 5).map((e, i) => <li key={i}>Row {e.row}: {e.error}</li>)}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
