import type { RtpPacketBuilder } from "./rtp-frame";

export interface ContinuousSender {
  enqueue(payload: Buffer): void;
  stop(): void;
}

export function createContinuousSender(deps: {
  send: (packet: Buffer) => Promise<void>;
  builder: RtpPacketBuilder;
  frameBytes?: number;
  intervalMs?: number;
}): ContinuousSender {
  const frameBytes = deps.frameBytes ?? 160;
  const intervalMs = deps.intervalMs ?? 20;
  const silence = Buffer.alloc(frameBytes, 0xff);
  let queue: Buffer[] = [];

  const timer = setInterval(() => {
    const frame = queue.length ? queue.shift()! : silence;
    // Fire-and-forget por design: o timer não pode travar esperando uma
    // rede lenta, senão perde a cadência de 20ms — mesma escolha do
    // script provado (udp.send com callback, não await no timer).
    deps.send(deps.builder.build(frame)).catch(() => undefined);
  }, intervalMs);

  return {
    enqueue(payload: Buffer): void {
      queue = [];
      for (let offset = 0; offset < payload.length; offset += frameBytes) {
        let frame = payload.subarray(offset, offset + frameBytes);
        if (frame.length < frameBytes) {
          const padded = Buffer.alloc(frameBytes, 0xff);
          frame.copy(padded);
          frame = padded;
        }
        queue.push(Buffer.from(frame));
      }
    },
    stop(): void {
      clearInterval(timer);
    },
  };
}
