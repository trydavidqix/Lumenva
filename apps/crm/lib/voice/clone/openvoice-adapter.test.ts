import { describe, expect, it, vi } from "vitest";
import {
  createOpenVoiceCloneRequester,
  createOpenVoiceTtsPort,
  type OpenVoiceClient,
} from "./openvoice-adapter";
import type { VoiceAudioFrame } from "../runtime/stt-port";

async function* frames(): AsyncIterable<VoiceAudioFrame> {
  yield { data: new Uint8Array([1]), encoding: "pcm_s16le", sampleRateHz: 24000, channels: 1, timestampMs: 0 };
}

describe("OpenVoice clone lifecycle (Fase 3)", () => {
  it("requests a clone profile only when consent was verified and a sample is given", async () => {
    const client: OpenVoiceClient = {
      createCloneProfile: vi.fn().mockResolvedValue({ cloneProfileId: "clone-1", quality: "accepted" }),
      revokeCloneProfile: vi.fn(),
      synthesizeStream: vi.fn(),
    };
    const requester = createOpenVoiceCloneRequester({ client });

    await expect(
      requester.requestClone({
        organizationId: "org-1",
        consentVerified: true,
        sampleAudioRef: "storage://org-1/voice-samples/lead-owner.wav",
        locale: "pt-PT",
      }),
    ).resolves.toEqual({ cloneProfileId: "clone-1" });
  });

  it("never proceeds without verified consent, regardless of a valid sample", async () => {
    const client: OpenVoiceClient = {
      createCloneProfile: vi.fn(),
      revokeCloneProfile: vi.fn(),
      synthesizeStream: vi.fn(),
    };
    const requester = createOpenVoiceCloneRequester({ client });

    await expect(
      requester.requestClone({
        organizationId: "org-1",
        consentVerified: false,
        sampleAudioRef: "storage://org-1/voice-samples/lead-owner.wav",
        locale: "pt-PT",
      }),
    ).rejects.toThrow(/verified consent/);
    expect(client.createCloneProfile).not.toHaveBeenCalled();
  });

  it("rejects when the provider itself rejects clone quality", async () => {
    const client: OpenVoiceClient = {
      createCloneProfile: vi.fn().mockResolvedValue({ cloneProfileId: "", quality: "rejected", reason: "áudio muito curto" }),
      revokeCloneProfile: vi.fn(),
      synthesizeStream: vi.fn(),
    };
    const requester = createOpenVoiceCloneRequester({ client });

    await expect(
      requester.requestClone({
        organizationId: "org-1",
        consentVerified: true,
        sampleAudioRef: "storage://org-1/voice-samples/lead-owner.wav",
        locale: "pt-PT",
      }),
    ).rejects.toThrow(/áudio muito curto/);
  });

  it("revokes an existing clone profile by id", async () => {
    const client: OpenVoiceClient = {
      createCloneProfile: vi.fn(),
      revokeCloneProfile: vi.fn().mockResolvedValue(undefined),
      synthesizeStream: vi.fn(),
    };
    const requester = createOpenVoiceCloneRequester({ client });

    await requester.revoke("clone-1");
    expect(client.revokeCloneProfile).toHaveBeenCalledWith("clone-1");
  });

  it("rejects revoking a blank id without touching the client", async () => {
    const client: OpenVoiceClient = { createCloneProfile: vi.fn(), revokeCloneProfile: vi.fn(), synthesizeStream: vi.fn() };
    const requester = createOpenVoiceCloneRequester({ client });

    await expect(requester.revoke("  ")).rejects.toThrow(/required to revoke/);
    expect(client.revokeCloneProfile).not.toHaveBeenCalled();
  });
});

describe("OpenVoice TTS adapter (Fase 3)", () => {
  it("synthesizes with the bound cloneProfileId, ignoring any voiceId override", async () => {
    const synthesizeStream = vi.fn().mockReturnValue(frames());
    const port = createOpenVoiceTtsPort({ client: { createCloneProfile: vi.fn(), revokeCloneProfile: vi.fn(), synthesizeStream }, cloneProfileId: "clone-1" });

    await port.synthesize("bom dia", {
      locale: "pt-PT",
      signal: new AbortController().signal,
      voice: { voiceId: "someone-elses-preset-voice" },
    });

    expect(synthesizeStream).toHaveBeenCalledWith(expect.objectContaining({ cloneProfileId: "clone-1" }));
    expect(synthesizeStream.mock.calls[0]![0]).not.toHaveProperty("voiceId");
  });

  it("rejects empty text before touching the client", async () => {
    const client: OpenVoiceClient = { createCloneProfile: vi.fn(), revokeCloneProfile: vi.fn(), synthesizeStream: vi.fn() };
    const port = createOpenVoiceTtsPort({ client, cloneProfileId: "clone-1" });

    await expect(port.synthesize("", { locale: "pt-PT", signal: new AbortController().signal })).rejects.toThrow(
      /empty text/,
    );
    expect(client.synthesizeStream).not.toHaveBeenCalled();
  });

  it("cancel() aborts the underlying stream for barge-in", async () => {
    let capturedSignal: AbortSignal | undefined;
    const synthesizeStream = vi.fn((input: { signal: AbortSignal }) => {
      capturedSignal = input.signal;
      return frames();
    });
    const port = createOpenVoiceTtsPort({ client: { createCloneProfile: vi.fn(), revokeCloneProfile: vi.fn(), synthesizeStream }, cloneProfileId: "clone-1" });

    const playback = await port.synthesize("bom dia", { locale: "pt-PT", signal: new AbortController().signal });
    await playback.cancel();
    expect(capturedSignal?.aborted).toBe(true);
  });

  it("fails closed when constructed without a cloneProfileId — never falls back to a shared voice", () => {
    expect(() =>
      createOpenVoiceTtsPort({ client: { createCloneProfile: vi.fn(), revokeCloneProfile: vi.fn(), synthesizeStream: vi.fn() }, cloneProfileId: "" }),
    ).toThrow(/never falls back/);
  });
});
