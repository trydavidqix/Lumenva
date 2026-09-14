function normalizeBaseUrl(value) {
  const url = String(value ?? "").trim().replace(/\/+$/, "");
  if (!url) throw new Error("Speaches health baseUrl is required");
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Speaches health baseUrl must use http(s)");
  return parsed.toString().replace(/\/$/, "");
}

export function createSpeachesHealthCheck({ baseUrl, timeoutMs = 2_000, fetchImpl = globalThis.fetch } = {}) {
  const normalized = normalizeBaseUrl(baseUrl);
  const timeout = Number(timeoutMs);
  if (!Number.isFinite(timeout) || timeout <= 0) throw new Error("Speaches health timeoutMs must be positive");
  if (typeof fetchImpl !== "function") throw new Error("Speaches health fetch implementation is required");

  return async function checkSpeachesHealth() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error("local_speech_health_timeout")), timeout);
    try {
      const response = await fetchImpl(`${normalized}/v1/models`, {
        method: "GET",
        signal: controller.signal,
      });
      return response?.ok === true;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  };
}
