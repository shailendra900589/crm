"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type SearchableOption = {
  value: string;
  label: string;
  description?: string;
};

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Search or select...",
  disabled,
  className,
  searchPlaceholder = "Type to search...",
  emptyText = "No results found",
}: {
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  searchPlaceholder?: string;
  emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.description?.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q)
    );
  }, [options, query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open) {
      setHighlight(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQuery("");
    }
  }, [open]);

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  const selectOption = (optionValue: string) => {
    onChange(optionValue);
    setOpen(false);
    setQuery("");
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[highlight]) {
      e.preventDefault();
      selectOption(filtered[highlight].value);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  useEffect(() => {
    const el = listRef.current?.children[highlight] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [highlight]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKeyDown}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-3 rounded-xl border bg-white px-4 text-left text-sm shadow-sm transition",
          open
            ? "border-violet-400 ring-2 ring-violet-100"
            : "border-slate-200 hover:border-slate-300",
          disabled && "cursor-not-allowed bg-slate-50 opacity-60"
        )}
      >
        <span className={cn("min-w-0 truncate font-medium", !selected && "font-normal text-slate-400")}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-400 transition", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-900/5">
          <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2.5">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="rounded-md p-0.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <ul ref={listRef} className="max-h-60 overflow-y-auto py-1">
            {filtered.length ? (
              filtered.map((o, i) => (
                <li key={o.value}>
                  <button
                    type="button"
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => selectOption(o.value)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm transition",
                      (o.value === value || i === highlight) && "bg-violet-50",
                      o.value === value ? "text-violet-700" : "text-slate-700 hover:bg-violet-50"
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{o.label}</p>
                      {o.description && <p className="truncate text-xs text-slate-500">{o.description}</p>}
                    </div>
                    {o.value === value && <Check className="h-4 w-4 shrink-0 text-violet-600" />}
                  </button>
                </li>
              ))
            ) : (
              <li className="px-3 py-8 text-center text-sm text-slate-400">{emptyText}</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
