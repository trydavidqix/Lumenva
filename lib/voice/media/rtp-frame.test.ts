import { describe, expect, it } from "vitest";
import { createRtpPacketBuilder, parseRtpPacket } from "./rtp-frame";

describe("parseRtpPacket", () => {
  it("descarta os 12 bytes de header e devolve só o payload", () => {
    const header = Buffer.alloc(12);
    header[0] = 0x80;
    const payload = Buffer.from([1, 2, 3, 4]);
    const packet = Buffer.concat([header, payload]);
    const result = parseRtpPacket(packet);
    expect(result).not.toBeNull();
    expect(result!.payload).toEqual(payload);
  });

  it("devolve null pra pacote menor que o header RTP (12 bytes)", () => {
    expect(parseRtpPacket(Buffer.alloc(8))).toBeNull();
  });
});

describe("createRtpPacketBuilder", () => {
  it("monta pacotes com seq/ts crescentes e o mesmo ssrc", () => {
    const builder = createRtpPacketBuilder();
    const payload = Buffer.alloc(160, 0xff);
    const p1 = builder.build(payload);
    const p2 = builder.build(payload);
    expect(p1.length).toBe(172); // 12 header + 160 payload
    const seq1 = p1.readUInt16BE(2);
    const seq2 = p2.readUInt16BE(2);
    expect(seq2).toBe((seq1 + 1) & 0xffff);
    const ts1 = p1.readUInt32BE(4);
    const ts2 = p2.readUInt32BE(4);
    expect(ts2).toBe((ts1 + 160) >>> 0);
    expect(p1.readUInt32BE(8)).toBe(p2.readUInt32BE(8)); // ssrc constante
    expect(p1.subarray(12)).toEqual(payload);
  });

  it("supports custom ssrc", () => {
    const customSsrc = 0x12345678;
    const builder = createRtpPacketBuilder(customSsrc);
    const packet = builder.build(Buffer.alloc(160));
    expect(packet.readUInt32BE(8)).toBe(customSsrc);
  });
});
