import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRealtimeChannel } from "@/hooks/realtime/useRealtimeChannel";
import * as AuthProvider from "@/hooks/auth/AuthProvider";

vi.mock("@/hooks/auth/AuthProvider", () => ({
  useActiveOrg: vi.fn(),
}));

type MockEvent = { data: string };
type MockEventListener = (event: MockEvent) => void;
type MockEventSourceOptions = { withCredentials?: boolean };

class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  withCredentials: boolean;
  listeners: Record<string, MockEventListener[]> = {};

  constructor(url: string, opts?: MockEventSourceOptions) {
    this.url = url;
    this.withCredentials = opts?.withCredentials ?? false;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: MockEventListener) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(listener);
  }

  removeEventListener(_type: string, _listener: MockEventListener) {}

  close() {}

  emit(type: string, event: MockEvent) {
    if (this.listeners[type]) {
      this.listeners[type].forEach(l => l(event));
    }
  }
}

describe("F5 Task 5 - useRealtimeChannel SSE Migration", () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal("EventSource", MockEventSource);

    vi.spyOn(AuthProvider, "useActiveOrg").mockReturnValue({ orgId: "o-1", name: "Org", role: "viewer" } as unknown as ReturnType<typeof AuthProvider.useActiveOrg>);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("should connect using SSE to /api/v1/realtime/events when enabled", () => {
    const onChange = vi.fn();

    renderHook(() => useRealtimeChannel({ name: "test", onChange }));

    expect(MockEventSource.instances).toHaveLength(1);
    const instance = MockEventSource.instances[0];
    if (!instance) throw new Error("instance not found");
    const url = new URL(instance.url, "http://localhost");
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
    renderHook(() => useRealtimeChannel({
       name: "test",
       postgresChanges: { event: "*", table: "my_table" },
       onChange
    }));

    expect(MockEventSource.instances).toHaveLength(1);
    const instance = MockEventSource.instances[0];
    if (!instance) throw new Error("instance not found");

    const mockRow = { entity_kind: "my_table", payload: { id: "123" } };
    instance.emit("message", { data: JSON.stringify(mockRow) });

    expect(onChange).toHaveBeenCalledWith(mockRow);
  });
});
