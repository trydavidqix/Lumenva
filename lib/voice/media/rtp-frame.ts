/**
 * Build/parse mínimo de pacote RTP (RFC 3550) — só o suficiente pro par de
 * campos que o Asterisk ARI externalMedia usa (seq/ts/ssrc), payload
 * opaco (µ-law já vem codificado por quem chama). Porta de
 * `audio_bridge_v15.mjs` (buildRtpPacket), já provado numa ligação real.
 */
const RTP_HEADER_BYTES = 12;
const PAYLOAD_STEP = 160; // 20ms de µ-law a 8kHz, mesmo passo do script provado

export function parseRtpPacket(packet: Buffer): { payload: Buffer } | null {
  if (packet.length < RTP_HEADER_BYTES) return null;
  return { payload: packet.subarray(RTP_HEADER_BYTES) };
}

export interface RtpPacketBuilder {
  /**
   * Builds an RTP packet with the given payload.
   *
   * **Constraint:** Payload MUST be exactly 160 bytes (PAYLOAD_STEP, 20ms @ 8kHz µ-law)
   * for correct timestamp alignment. Timestamp increments by 160 on each call;
   * non-standard payload sizes will cause silent drift from real-time clock.
   * This is a faithful port of the VPS script's assumption; enforce in callers.
   */
  build(payload: Buffer): Buffer;
}

export function createRtpPacketBuilder(ssrc = 0xdeadbeef): RtpPacketBuilder {
  let seq = 0;
  let ts = 0;
  return {
    build(payload: Buffer): Buffer {
      const header = Buffer.alloc(RTP_HEADER_BYTES);
      header[0] = 0x80;
      header[1] = 0x00;
      header.writeUInt16BE(seq & 0xffff, 2);
      header.writeUInt32BE(ts >>> 0, 4);
      header.writeUInt32BE(ssrc, 8);
      seq += 1;
      ts += PAYLOAD_STEP;
      return Buffer.concat([header, payload]);
    },
  };
}
