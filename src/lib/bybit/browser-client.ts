const BROWSER_BYBIT_BASE_URLS = [
  "https://api.bytick.com",
  "https://api.bybit.com",
];

interface BybitResponse<T> {
  retCode: number;
  retMsg: string;
  result: T;
}

export class BrowserBybitError extends Error {
  readonly status?: number;
  readonly baseUrl?: string;

  constructor(
    message: string,
    options: { status?: number; baseUrl?: string; cause?: unknown },
  ) {
    super(message, { cause: options.cause });
    this.name = "BrowserBybitError";
    this.status = options.status;
    this.baseUrl = options.baseUrl;
  }
}

function isRetryable(error: BrowserBybitError): boolean {
  if (error.cause instanceof Error) {
    const message = error.cause.message.toLowerCase();
    if (message.includes("fetch failed") || message.includes("network")) {
      return true;
    }
  }

  return (
    error.status === 403 ||
    error.status === 429 ||
    error.status === 502 ||
    error.status === 503
  );
}

async function browserBybitGetFromBase<T>(
  baseUrl: string,
  path: string,
  params?: Record<string, string | number>,
): Promise<T> {
  const url = new URL(path.startsWith("/") ? path : `/${path}`, baseUrl);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }
  }

  let response: Response;

  try {
    response = await fetch(url.toString(), {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
  } catch (error) {
    throw new BrowserBybitError(`Bybit request failed: ${path}`, {
      baseUrl,
      cause: error,
    });
  }

  if (!response.ok) {
    throw new BrowserBybitError(`Bybit HTTP ${response.status}`, {
      status: response.status,
      baseUrl,
    });
  }

  const body = (await response.json()) as BybitResponse<T>;
  if (body.retCode !== 0) {
    throw new BrowserBybitError(`Bybit API error ${body.retCode}: ${body.retMsg}`, {
      baseUrl,
    });
  }

  return body.result;
}

/** Browser-side Bybit public API fetch (uses user network — works on Vercel). */
export async function browserBybitGet<T>(
  path: string,
  params?: Record<string, string | number>,
): Promise<T> {
  let lastError: BrowserBybitError | undefined;

  for (let index = 0; index < BROWSER_BYBIT_BASE_URLS.length; index += 1) {
    const baseUrl = BROWSER_BYBIT_BASE_URLS[index];
    const isLast = index === BROWSER_BYBIT_BASE_URLS.length - 1;

    try {
      return await browserBybitGetFromBase<T>(baseUrl, path, params);
    } catch (error) {
      if (!(error instanceof BrowserBybitError)) {
        throw error;
      }

      lastError = error;
      if (!isLast && isRetryable(error)) {
        continue;
      }

      throw error;
    }
  }

  throw lastError ?? new BrowserBybitError("Bybit request failed", {});
}
