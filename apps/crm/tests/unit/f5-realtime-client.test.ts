import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useRealtimeChannel } from "@/hooks/realtime/useRealtimeChannel";
import * as AuthProvider from "@/hooks/auth/AuthProvider";

vi.mock("@/hooks/auth/AuthProvider", () => ({
  useActiveOrg: vi.fn(),
}));

class MockEventSource {
  static instances: any[] = [];
  url: string;
  withCredentials: boolean;
  listeners: Record<string, Function[]> = {};

  constructor(url: string, opts: any) {
    this.url = url;
    this.withCredentials = opts?.withCredentials;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: Function) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(listener);
  }

  removeEventListener(type: string, listener: Function) {}

  close() {}

  emit(type: string, event: any) {
    if (this.listeners[type]) {
      this.listeners[type].forEach(l => l(event));
    }
  }
}

describe("F5 Task 5 - useRealtimeChannel SSE Migration", () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal("EventSource", MockEventSource);

    vi.spyOn(AuthProvider, "useActiveOrg").mockReturnValue({ orgId: "o-1", name: "Org", role: "viewer" } as any);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("should connect using SSE to /api/v1/realtime/events when enabled", async () => {
    const onChange = vi.fn();

    renderHook(() => useRealtimeChannel({ name: "test", onChange }));

    expect(MockEventSource.instances).toHaveLength(1);
    const url = new URL(MockEventSource.instances[0].url, "http://localhost");
    expect(url.pathname).toBe("/api/v1/realtime/events");
    expect(url.searchParams.get("organization_id")).toBe("o-1");
  });

  it("should not connect when disabled", () => {
    const onChange = vi.fn();
    renderHook(() => useRealtimeChannel({ name: "test", onChange, enabled: false }));
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it("should map table/filter correctly and trigger onChange when message matches", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useRealtimeChannel({
       name: "test",
       postgresChanges: { event: "*", table: "my_table" },
       onChange
    }));

    expect(MockEventSource.instances).toHaveLength(1);
    const instance = MockEventSource.instances[0];

    const mockRow = { entity_kind: "my_table", payload: { id: "123" } };
    instance.emit("message", { data: JSON.stringify(mockRow) });

    expect(onChange).toHaveBeenCalledWith(mockRow);
  });
});
