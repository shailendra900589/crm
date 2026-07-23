"use client";

import { getWsUrl } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

export function useLiveDashboard(scope: string) {
  const qc = useQueryClient();
  const [pulse, setPulse] = useState(false);
  const retryRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;

    const connect = () => {
      const token = localStorage.getItem("access");
      if (!token || closed) return;

      ws = new WebSocket(`${getWsUrl()}/ws/dashboard/${scope}/?token=${token}`);

      ws.onopen = () => {
        if (closed) {
          ws?.close();
          return;
        }
        retryRef.current = 0;
      };

      ws.onmessage = (ev) => {
        setPulse(true);
        setTimeout(() => setPulse(false), 1200);
        try {
          const data = JSON.parse(ev.data);
          if (data.job_id) {
            qc.invalidateQueries({ queryKey: ["bulk-job", data.job_id] });
          }
        } catch {
          /* ignore */
        }
        qc.invalidateQueries({ queryKey: ["dashboard"] });
        qc.invalidateQueries({ queryKey: ["leads"] });
        qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
        qc.invalidateQueries({ queryKey: ["teams"] });
        qc.invalidateQueries({ queryKey: ["admin-managers"] });
        qc.invalidateQueries({ queryKey: ["visits"] });
        qc.invalidateQueries({ queryKey: ["lead"] });
        qc.invalidateQueries({ queryKey: ["project"] });
        qc.invalidateQueries({ queryKey: ["projects"] });
        qc.invalidateQueries({ queryKey: ["custom-form"] });
        qc.invalidateQueries({ queryKey: ["users"] });
        qc.invalidateQueries({ queryKey: ["products"] });
        qc.invalidateQueries({ queryKey: ["merchants"] });
        qc.invalidateQueries({ queryKey: ["notifications"] });
        qc.invalidateQueries({ queryKey: ["lead-activity"] });
        qc.invalidateQueries({ queryKey: ["audit-logs"] });
        qc.invalidateQueries({ queryKey: ["follow-ups"] });
        qc.invalidateQueries({ queryKey: ["alerts"] });
        qc.invalidateQueries({ queryKey: ["pipeline"] });
        qc.invalidateQueries({ queryKey: ["duplicate-groups"] });
      };

      ws.onclose = () => {
        if (closed) return;
        const delay = Math.min(1000 * 2 ** retryRef.current, 15000);
        retryRef.current += 1;
        timerRef.current = setTimeout(connect, delay);
      };

      ws.onerror = () => ws?.close();
    };

    connect();

    return () => {
      closed = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (!ws) return;
      // Stop reconnect loops; only close an already-open socket.
      // Closing while CONNECTING triggers a noisy browser error in React Strict Mode.
      ws.onclose = null;
      ws.onerror = null;
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [scope, qc]);

  return { pulse };
}
