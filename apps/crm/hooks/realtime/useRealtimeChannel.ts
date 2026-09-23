"use client";

import { useEffect, useRef, useState, useId, type RefObject } from "react";
import { useActiveOrg } from "@/hooks/auth/AuthProvider";

export type RealtimeStatus = "closed" | "connecting" | "subscribed" | "channel_error" | "timed_out";

export interface UseRealtimeChannelOpts {
  name: string;
  postgresChanges?: {
    event: "INSERT" | "UPDATE" | "DELETE" | "*";
    schema?: string;
    table: string;
    filter?: string;
  };
  broadcast?: { event: string };
  onChange: (payload: unknown) => void;
  enabled?: boolean;
}

const _AUTH_TIMEOUT_MS = 1_500;
let realtimeAuth: Promise<void> | null = null;

// Preserve export with previous behavior for backwards compatibility during transition or tests
export function __resetRealtimeAuth(): void {
  realtimeAuth = null;
}

// Preserve export for backward compatibility. Does nothing.
export function authenticateRealtime(_supabase: unknown): Promise<void> {
  realtimeAuth ??= Promise.resolve();
  return realtimeAuth;
}

export function useRealtimeChannel(opts: UseRealtimeChannelOpts): {
  status: RealtimeStatus;
  ultimaEntrega: RefObject<number | null>;
} {
  const { name, postgresChanges, broadcast, onChange, enabled = true } = opts;
  const activeOrg = useActiveOrg();

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const ultimaEntrega = useRef<number | null>(null);

  // Initialize with correct state immediately if inactive
  const initialStatus = !enabled || !activeOrg?.orgId ? "closed" : "connecting";
  const [status, setStatus] = useState<RealtimeStatus>(initialStatus);
  const instanceId = useId();

  // Make sure we have stable references or dependencies are well scoped
  // to avoid hook trigger loops.
  const activeOrgId = activeOrg?.orgId;
  const pgEvent = postgresChanges?.event;
  const pgTable = postgresChanges?.table;
  const pgFilter = postgresChanges?.filter;
  const pgSchema = postgresChanges?.schema;
  const bcEvent = broadcast?.event;

  // React state cascade synchronization fix: update status when enable changes
  // only if necessary. Since we return closed on mount if not enabled, we just
  // check when deps change.
  useEffect(() => {
    if (!enabled || !activeOrgId) {
      // using a timeout prevents cascading renders warning
      const t = setTimeout(() => setStatus("closed"), 0);
      return () => clearTimeout(t);
    }

    // Safety check for jsdom/tests where EventSource might not exist
    if (typeof EventSource === "undefined") {
      return;
    }

    let cancelado = false;
    let es: EventSource | null = null;
    let reconnectTimeoutId: NodeJS.Timeout | null = null;

    function connect() {
      if (cancelado) return;

      setStatus("connecting");
      const url = new URL("/api/v1/realtime/events", window.location.origin);
      url.searchParams.set("organization_id", activeOrgId!);

      es = new EventSource(url.toString(), { withCredentials: true });

      es.addEventListener("open", () => {
        if (!cancelado) setStatus("subscribed");
      });

      es.addEventListener("message", (ev) => {
        if (cancelado) return;
        try {
          const data = JSON.parse(ev.data);

          let relevant = false;

          if (pgTable || pgEvent || pgFilter || pgSchema) {
            const expectedTable = pgTable;
            if (data.entity_kind === expectedTable || data.table === expectedTable) {
              relevant = true;
            }
          }

          if (bcEvent) {
            if (data.event === bcEvent || data.event_type === bcEvent || bcEvent === "*") {
              relevant = true;
            }
          }

          if (!pgTable && !pgEvent && !pgFilter && !pgSchema && !bcEvent) relevant = true;

          if (relevant) {
            ultimaEntrega.current = Date.now();
            onChangeRef.current(data);
          }
        } catch {
          // parse error
        }
      });

      es.addEventListener("error", () => {
        if (cancelado) return;
        setStatus("channel_error");
        console.error(`[realtime] canal degradado`, { channelName: name, status: "channel_error" });
        if (es) {
          es.close();
        }
        reconnectTimeoutId = setTimeout(() => {
          connect();
        }, 2000);
      });
    }

    connect();

    return () => {
      cancelado = true;
      if (es) {
        es.close();
      }
      if (reconnectTimeoutId) {
        clearTimeout(reconnectTimeoutId);
      }
    };
  }, [name, enabled, activeOrgId, pgEvent, pgTable, pgFilter, pgSchema, bcEvent, instanceId]);

  return { status, ultimaEntrega };
}
