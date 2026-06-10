/** Client fetch with timeout for MVP 95 activation status APIs. */
export async function fetchActivationStatus<T>(
  path: string,
  timeoutMs = 6_000,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(path, { cache: "no-store", signal: controller.signal });
    const data = (await res.json()) as T & { ok?: boolean; error?: string };
    if (!res.ok || data.ok === false) {
      return { ok: false, error: data.error ?? `Request failed (${res.status})` };
    }
    return { ok: true, data };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, error: "Request timed out — showing last known state if available." };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Request failed",
    };
  } finally {
    window.clearTimeout(timer);
  }
}
