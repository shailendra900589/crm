"use client";

import { Badge, Button, Input } from "@/components/ui";
import { api, fileUrl, type LeadDocument } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Download, Eye, FileText, Upload, XCircle } from "lucide-react";
import { useState } from "react";

const DOC_FIELDS = [
  { key: "gst_file" as const, label: "GST Certificate", accept: "image/*,.pdf" },
  { key: "pan_file" as const, label: "PAN Card", accept: "image/*,.pdf" },
  { key: "cheque_file" as const, label: "Cancelled Cheque", accept: "image/*,.pdf" },
];

type DocField = (typeof DOC_FIELDS)[number]["key"];

export type FormFileUpload = {
  field_id: string;
  label: string;
  url: string;
};

export function DocumentsPanel({
  leadId,
  doc,
  formFiles = [],
  canVerify,
}: {
  leadId: number;
  doc?: LeadDocument;
  /** Dynamic form file fields saved on the lead */
  formFiles?: FormFileUpload[];
  canVerify: boolean;
}) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState<DocField | null>(null);
  const [preview, setPreview] = useState<{ url: string; label: string } | null>(null);

  const upload = useMutation({
    mutationFn: ({ field, file }: { field: DocField; file: File }) => {
      const form = new FormData();
      form.append(field, file);
      return api.uploadDocuments(leadId, form);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead", leadId] });
      qc.invalidateQueries({ queryKey: ["lead-activity", leadId] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setUploading(null);
    },
    onError: () => setUploading(null),
  });

  const verify = useMutation({
    mutationFn: (status: "approved" | "rejected") => api.verifyDocuments(leadId, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead", leadId] });
      qc.invalidateQueries({ queryKey: ["lead-activity", leadId] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const getUrl = (field: DocField) => {
    if (!doc) return null;
    const urlKey = `${field}_url` as keyof LeadDocument;
    return fileUrl(doc[field] as string | null, doc[urlKey] as string | null);
  };

  const getName = (field: DocField) => {
    const path = doc?.[field];
    if (!path) return null;
    return path.split("/").pop() || field;
  };

  const isImage = (url: string) => /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(url);
  const hasFormFiles = formFiles.some((f) => !!f.url);
  const hasLegacyDocs = !!getUrl("gst_file") || !!getUrl("pan_file") || !!getUrl("cheque_file");
  const hasAnyDoc = hasLegacyDocs || hasFormFiles;
  const showLegacySlots = !hasFormFiles || hasLegacyDocs;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/50">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Verification:</span>
        <Badge
          status={
            doc?.verification_status === "approved"
              ? "approved"
              : doc?.verification_status === "rejected"
                ? "rejected"
                : "pending"
          }
          label={doc?.verification_status || (hasAnyDoc ? "pending" : "no uploads")}
        />
        {doc?.verified_by_name && (
          <span className="text-xs text-slate-500">by {doc.verified_by_name}</span>
        )}
      </div>

      {hasFormFiles && (
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Form uploads</p>
          {formFiles.filter((f) => !!f.url).map((f) => {
            const url = fileUrl(f.url) || f.url;
            return (
            <div key={f.field_id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/50">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{f.label}</p>
              </div>
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
                {isImage(url) ? (
                  <img src={url} alt={f.label} className="h-28 w-full max-w-[200px] rounded-xl border border-slate-200 object-cover" />
                ) : (
                  <div className="flex h-28 w-full max-w-[200px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50">
                    <FileText className="h-10 w-10 text-slate-300" />
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" className="h-9 gap-1.5 text-xs" onClick={() => setPreview({ url, label: f.label })}>
                    <Eye className="h-3.5 w-3.5" /> Show
                  </Button>
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <Download className="h-3.5 w-3.5" /> Open
                  </a>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {showLegacySlots && DOC_FIELDS.map(({ key, label, accept }) => {
        const url = getUrl(key);
        // When form uploads exist, only show legacy slots that already have a file
        if (hasFormFiles && !url) return null;
        const name = getName(key);
        const busy = uploading === key || (upload.isPending && uploading === key);

        return (
          <div key={key} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/50">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</p>
            </div>
            <div className="p-4">
              {url ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  {isImage(url) ? (
                    <img src={url} alt={label} className="h-28 w-full max-w-[200px] rounded-xl border border-slate-200 object-cover" />
                  ) : (
                    <div className="flex h-28 w-full max-w-[200px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50">
                      <FileText className="h-10 w-10 text-slate-300" />
                    </div>
                  )}
                  <div className="flex-1 space-y-2">
                    <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{name}</p>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" className="h-9 gap-1.5 text-xs" onClick={() => setPreview({ url, label })}>
                        <Eye className="h-3.5 w-3.5" /> Show
                      </Button>
                      <Button
                        variant="outline"
                        className="h-9 gap-1.5 text-xs"
                        onClick={() => api.downloadDocument(leadId, key, name || undefined)}
                      >
                        <Download className="h-3.5 w-3.5" /> Download
                      </Button>
                      <label className={cn("inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50", busy && "pointer-events-none opacity-50")}>
                        <Upload className="h-3.5 w-3.5" />
                        Replace
                        <Input
                          type="file"
                          accept={accept}
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setUploading(key);
                            upload.mutate({ field: key, file });
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              ) : (
                <label className={cn("flex cursor-pointer flex-col items-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center transition hover:border-indigo-300 hover:bg-indigo-50/30", busy && "pointer-events-none opacity-50")}>
                  <Upload className="h-8 w-8 text-slate-300" />
                  <p className="mt-2 text-sm font-medium text-slate-600">Upload {label}</p>
                  <p className="mt-0.5 text-xs text-slate-400">PDF or image · max 10MB</p>
                  <Input
                    type="file"
                    accept={accept}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploading(key);
                      upload.mutate({ field: key, file });
                    }}
                  />
                </label>
              )}
              {busy && <p className="mt-2 text-xs text-indigo-600">Uploading to storage...</p>}
            </div>
          </div>
        );
      })}

      {!hasAnyDoc && (
        <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700">
          No documents uploaded yet. BDM form file fields appear here after upload/submit.
        </p>
      )}

      {canVerify && hasAnyDoc && (
        <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <p className="w-full text-xs text-slate-500">Manager / TL / Admin verification</p>
          <Button
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
            disabled={verify.isPending}
            onClick={() => verify.mutate("approved")}
          >
            <CheckCircle2 className="h-4 w-4" /> Verify / Approve
          </Button>
          <Button
            variant="danger"
            className="gap-1.5"
            disabled={verify.isPending}
            onClick={() => verify.mutate("rejected")}
          >
            <XCircle className="h-4 w-4" /> Reject
          </Button>
          {verify.isError && (
            <p className="w-full text-xs text-rose-600">{(verify.error as Error)?.message || "Verify failed"}</p>
          )}
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={() => setPreview(null)}>
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">{preview.label}</h3>
              <Button variant="outline" className="h-8 text-xs" onClick={() => setPreview(null)}>Close</Button>
            </div>
            {isImage(preview.url) ? (
              <img src={preview.url} alt={preview.label} className="mx-auto max-h-[70vh] rounded-xl" />
            ) : (
              <iframe src={preview.url} title={preview.label} className="h-[70vh] w-full rounded-xl border border-slate-200" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
