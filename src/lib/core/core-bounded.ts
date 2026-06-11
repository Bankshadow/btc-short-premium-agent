import { API_RESPONSE_BOUND_MS } from "./zero-state";

export const CORE_CHECK_BOUND_MS = API_RESPONSE_BOUND_MS;

export async function withBoundedCheck<T>(
  fn: () => Promise<T>,
  fallback: T,
  boundMs = CORE_CHECK_BOUND_MS - 300,
): Promise<{ result: T; timedOut: boolean }> {
  let timedOut = false;
  let settled = false;

  const work = fn()
    .then((value) => {
      settled = true;
      return value;
    })
    .catch(() => {
      settled = true;
      return fallback;
    });

  const timer = new Promise<T>((resolve) => {
    setTimeout(() => {
      if (!settled) timedOut = true;
      resolve(fallback);
    }, boundMs);
  });

  const result = await Promise.race([work, timer]);
  return { result, timedOut };
}
