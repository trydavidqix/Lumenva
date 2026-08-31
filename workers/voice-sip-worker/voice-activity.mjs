// Lightweight RTP-side VAD. It avoids a model/dependency in the SIP worker:
// faster-whisper's vad_filter only runs after a batch has already been made.
const MULAW_BIAS = 0x84;

function decodeMulaw(value) {
  const byte = (~value) & 0xff;
  const magnitude = ((byte & 0x0f) << 3) + MULAW_BIAS;
  const sample = magnitude << ((byte & 0x70) >> 4);
  return (byte & 0x80) ? MULAW_BIAS - sample : sample - MULAW_BIAS;
}

export function payloadRms(payload) {
  if (!payload || payload.length === 0) return 0;
  let sum = 0;
  for (const value of payload) {
    const sample = decodeMulaw(value);
    sum += sample * sample;
  }
  return Math.sqrt(sum / payload.length);
}

export function createVoiceActivitySegmenter(options = {}) {
  const threshold = options.threshold ?? 180;
  const minSpeechMs = options.minSpeechMs ?? 180;
  const endSilenceMs = options.endSilenceMs ?? 420;
  const preRollMs = options.preRollMs ?? 160;
  const frameMs = options.frameMs ?? 20;
  let frames = [];
  let speechMs = 0;
  let silenceMs = 0;
  let inSpeech = false;

  function reset() {
    frames = [];
    speechMs = 0;
    silenceMs = 0;
    inSpeech = false;
  }

  function push(payload) {
    const active = payloadRms(payload) >= threshold;
    if (!inSpeech) {
      frames.push(payload);
      if (frames.length * frameMs > preRollMs) frames.shift();
      if (active) {
        inSpeech = true;
        speechMs = frameMs;
        silenceMs = 0;
      }
      return null;
    }
    frames.push(payload);
    if (active) {
      speechMs += frameMs;
      silenceMs = 0;
      return null;
    }
    silenceMs += frameMs;
    if (speechMs >= minSpeechMs && silenceMs >= endSilenceMs) {
      const segment = frames;
      reset();
      return segment;
    }
    return null;
  }

  function flush() {
    if (!inSpeech || speechMs < minSpeechMs || frames.length === 0) {
      reset();
      return null;
    }
    const segment = frames;
    reset();
    return segment;
  }

  return { push, flush, reset };
}
