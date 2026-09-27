import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { parseNotificationAckToken, tryAcknowledgeNotification } from "./ack";

describe("notification acknowledgement token", () => {
  it("accepts only an explicit CONFIRMAR command with a six-character token", () => {
    expect(parseNotificationAckToken("CONFIRMAR AB23XZ")).toBe("AB23XZ");
    expect(parseNotificationAckToken("  confirmar ab23xz  ")).toBe("AB23XZ");
    expect(parseNotificationAckToken("ok")).toBeNull();
    expect(parseNotificationAckToken("CONFIRMAR")).toBeNull();
    expect(parseNotificationAckToken("CONFIRMAR ABC")).toBeNull();
    expect(parseNotificationAckToken("CONFIRMAR ABC1234")).toBeNull();
  });

  it("rejects a command embedded in surrounding text", () => {
    expect(parseNotificationAckToken("prefixCONFIRMAR AB23XZsuffix")).toBeNull();
  });

  it("acknowledges only the matching tenant and contact, then disables its pending timer", async () => {
    const notification = {
      id: "notification-1",
      organization_id: "org-1",
      contact_id: "contact-1",
      ack_token: "AB23XZ",
      status: "whatsapp_sent",
      acknowledged_at: null as string | null,
    };
    const cron = {
      organization_id: "org-1",
      contact_id: "contact-1",
      job_kind: "notification_delivery",
      enabled: true,
      payload: { notification_id: "notification-1", phase: "voice" },
    };
    const admin = makeAdminStub(notification, cron);

    const result = await tryAcknowledgeNotification(admin.client, {
      organizationId: "org-1",
      contactId: "contact-1",
      body: "CONFIRMAR AB23XZ",
    });

    expect(result).toEqual({ acknowledged: true, notificationId: "notification-1" });
    expect(notification.status).toBe("acknowledged");
    expect(notification.acknowledged_at).toEqual(expect.any(String));
    expect(cron.enabled).toBe(false);
  });

  it("does not acknowledge a valid token belonging to another tenant", async () => {
    const notification = {
      id: "notification-1",
      organization_id: "org-2",
      contact_id: "contact-2",
      ack_token: "AB23XZ",
      status: "whatsapp_sent",
      acknowledged_at: null as string | null,
    };
    const cron = {
      organization_id: "org-2",
      contact_id: "contact-2",
      job_kind: "notification_delivery",
      enabled: true,
      payload: { notification_id: "notification-1", phase: "voice" },
    };
    const admin = makeAdminStub(notification, cron);

    const result = await tryAcknowledgeNotification(admin.client, {
      organizationId: "org-1",
      contactId: "contact-1",
      body: "CONFIRMAR AB23XZ",
    });

    expect(result).toEqual({ acknowledged: false, notificationId: null });
    expect(notification.status).toBe("whatsapp_sent");
    expect(cron.enabled).toBe(true);
  });
});

function makeAdminStub(
  notification: {
    id: string;
    organization_id: string;
    contact_id: string;
    ack_token: string;
    status: string;
    acknowledged_at: string | null;
  },
  cron: {
    organization_id: string;
    contact_id: string;
    job_kind: string;
    enabled: boolean;
    payload: Record<string, unknown>;
  },
) {
  const client = {
    from(table: string) {
      const state: {
        update?: Record<string, unknown>;
        eq: Record<string, unknown>;
        in?: Record<string, unknown[]>;
        is?: Record<string, unknown>;
        contains?: Record<string, unknown>;
      } = { eq: {} };
      const matches = (row: Record<string, unknown>) => {
        if (Object.entries(state.eq).some(([key, value]) => row[key] !== value)) return false;
        if (state.in && Object.entries(state.in).some(([key, values]) => !values.includes(row[key]))) return false;
        if (state.is && Object.entries(state.is).some(([key, value]) => row[key] !== value)) return false;
        if (state.contains && Object.entries(state.contains).some(([key, value]) => {
          const nested = row[key];
          return typeof nested !== "object" || nested === null || (nested as Record<string, unknown>)[Object.keys(value as object)[0]!] !== Object.values(value as object)[0];
        })) return false;
        return true;
      };
      const builder = {
        select() { return builder; },
        update(values: Record<string, unknown>) { state.update = values; return builder; },
        eq(key: string, value: unknown) { state.eq[key] = value; return builder; },
        in(key: string, values: unknown[]) { state.in = { ...(state.in ?? {}), [key]: values }; return builder; },
        is(key: string, value: unknown) { state.is = { ...(state.is ?? {}), [key]: value }; return builder; },
        contains(key: string, value: Record<string, unknown>) { state.contains = { ...(state.contains ?? {}), [key]: value }; return builder; },
        maybeSingle() {
          const row = table === "notification_requests" ? notification : null;
          if (!row || !matches(row)) return Promise.resolve({ data: null, error: null });
          if (!state.update) return Promise.resolve({ data: row, error: null });
          if (row.acknowledged_at !== null) return Promise.resolve({ data: null, error: null });
          Object.assign(row, state.update);
          return Promise.resolve({ data: { id: row.id }, error: null });
        },
        then(resolve: (value: { data: null; error: null }) => unknown) {
          if (table === "cron_jobs" && state.update && matches(cron)) Object.assign(cron, state.update);
          return Promise.resolve({ data: null, error: null }).then(resolve);
        },
      };
      return builder;
    },
  };
  return { client: client as unknown as SupabaseClient };
}
