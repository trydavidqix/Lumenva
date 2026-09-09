import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createContinuousSender } from "./continuous-sender";
import { createRtpPacketBuilder } from "./rtp-frame";

describe("createContinuousSender", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("manda silêncio a cada 20ms quando a fila está vazia", async () => {
    const sent: Buffer[] = [];
    const sender = createContinuousSender({
      send: async (packet) => { sent.push(packet); },
      builder: createRtpPacketBuilder(),
    });
    await vi.advanceTimersByTimeAsync(60);
    sender.stop();
    expect(sent.length).toBeGreaterThanOrEqual(3); // 60ms / 20ms
    // payload de silêncio = 0xff repetido (mesmo convenção do script provado, µ-law "silence byte")
    expect(sent[0]!.subarray(12).every((b) => b === 0xff)).toBe(true);
  });

  it("toca o áudio enfileirado frame a frame, volta pro silêncio quando acaba", async () => {
    const sent: Buffer[] = [];
    const sender = createContinuousSender({
      send: async (packet) => { sent.push(packet); },
      builder: createRtpPacketBuilder(),
      frameBytes: 4,
    });
    sender.enqueue(Buffer.from([1, 1, 1, 1, 2, 2, 2, 2])); // 2 frames de 4 bytes
    await vi.advanceTimersByTimeAsync(20); // 1º tick: frame 1
    await vi.advanceTimersByTimeAsync(20); // 2º tick: frame 2
    await vi.advanceTimersByTimeAsync(20); // 3º tick: volta a silêncio
    sender.stop();
    expect(sent[0]!.subarray(12)).toEqual(Buffer.from([1, 1, 1, 1]));
    expect(sent[1]!.subarray(12)).toEqual(Buffer.from([2, 2, 2, 2]));
    expect(sent[2]!.subarray(12).every((b) => b === 0xff)).toBe(true);
  });
});
