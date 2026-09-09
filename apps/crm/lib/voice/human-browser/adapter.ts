export interface BrowserTakeoverInput {
  organizationId: string;
  voiceCallId: string;
}

export type BrowserTakeoverResult =
  | { kind: "disabled" }
  | { kind: "ready"; roomName: string; token: string };

export type BrowserTakeoverPrepare = (
  input: BrowserTakeoverInput,
) => Promise<{ roomName: string; token: string }>;

export function createBrowserHumanVoiceAdapter(config: {
  enabled: boolean;
  prepare?: BrowserTakeoverPrepare;
}) {
  return {
    async prepareTakeover(input: BrowserTakeoverInput): Promise<BrowserTakeoverResult> {
      if (!config.enabled) return { kind: "disabled" };
      if (config.prepare === undefined) {
        throw new Error("browser human voice transport is enabled but no transport is configured");
      }
      const prepared = await config.prepare(input);
      return { kind: "ready", roomName: prepared.roomName, token: prepared.token };
    },
  };
}
