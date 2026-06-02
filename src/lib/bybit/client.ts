const DEFAULT_BYBIT_BASE_URLS = [
  "https://api.bytick.com",
  "https://api.bybit.com",
];

const BYBIT_USER_AGENT =
  "Mozilla/5.0 (compatible; BTCShortPremiumAgent/1.0; analysis-only)";

export interface BybitResponse<T> {
  retCode: number;
  retMsg: string;
  result: T;
  time?: number;
}

export class BybitApiError extends Error {
  readonly status?: number;
  readonly retCode?: number;
  readonly retMsg?: string;
  readonly path: string;
  readonly baseUrl?: string;

  constructor(
    message: string,
    options: {
      status?: number;
      retCode?: number;
      retMsg?: string;
      path: string;
      baseUrl?: string;
      cause?: unknown;
    },
  ) {
    super(message, { cause: options.cause });
    this.name = "BybitApiError";
    this.status = options.status;
    this.retCode = options.retCode;
    this.retMsg = options.retMsg;
    this.path = options.path;
    this.baseUrl = options.baseUrl;
  }
}

function resolveBybitBaseUrls(): string[] {
  const fromEnv = process.env.BYBIT_API_BASE_URL?.trim();
  const urls = fromEnv
    ? [fromEnv, ...DEFAULT_BYBIT_BASE_URLS]
    : DEFAULT_BYBIT_BASE_URLS;

  return [...new Set(urls)];
}

function isNetworkRetryError(error: unknown): boolean {
  if (!(error instanceof BybitApiError)) return false;

  const cause = error.cause;
  if (!(cause instanceof Error)) return false;

  const code = (cause as NodeJS.ErrnoException).code;
  return (
    code === "ENOTFOUND" ||
    code === "ECONNREFUSED" ||
    code === "ETIMEDOUT" ||
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    cause.message.toLowerCase().includes("fetch failed")
  );
}

/** Retry next Bybit domain on CDN/WAF blocks common on cloud hosts (e.g. Vercel). */
function isRetryableBybitError(error: unknown): boolean {
  if (!(error instanceof BybitApiError)) return false;
  if (isNetworkRetryError(error)) return true;

  return (
    error.status === 403 ||
    error.status === 429 ||
    error.status === 502 ||
    error.status === 503
  );
}

async function bybitGetFromBase<T>(
  baseUrl: string,
  path: string,
  params?: Record<string, string | number>,
): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(normalizedPath, baseUrl);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }
  }

  let response: Response;

  try {
    response = await fetch(url.toString(), {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": BYBIT_USER_AGENT,
      },
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Network request failed";
    throw new BybitApiError(
      `Bybit request failed: ${normalizedPath} (${detail})`,
      {
        path: normalizedPath,
        baseUrl,
        cause: error,
      },
    );
  }

  if (!response.ok) {
    throw new BybitApiError(
      `Bybit HTTP ${response.status}: ${response.statusText}`,
      {
        status: response.status,
        path: normalizedPath,
        baseUrl,
      },
    );
  }

  let body: BybitResponse<T>;

  try {
    body = (await response.json()) as BybitResponse<T>;
  } catch (error) {
    throw new BybitApiError(`Bybit invalid JSON: ${normalizedPath}`, {
      status: response.status,
      path: normalizedPath,
      baseUrl,
      cause: error,
    });
  }

  if (body.retCode !== 0) {
    throw new BybitApiError(
      `Bybit API error ${body.retCode}: ${body.retMsg}`,
      {
        status: response.status,
        retCode: body.retCode,
        retMsg: body.retMsg,
        path: normalizedPath,
        baseUrl,
      },
    );
  }

  return body.result;
}

/**
 * Read-only Bybit public API client with automatic domain fallback.
 * Analysis-only — no authenticated or trading endpoints.
 */
export async function bybitGet<T>(
  path: string,
  params?: Record<string, string | number>,
): Promise<T> {
  const baseUrls = resolveBybitBaseUrls();
  let lastError: BybitApiError | undefined;

  for (let index = 0; index < baseUrls.length; index += 1) {
    const baseUrl = baseUrls[index];
    const isLast = index === baseUrls.length - 1;

    try {
      return await bybitGetFromBase<T>(baseUrl, path, params);
    } catch (error) {
      if (!(error instanceof BybitApiError)) {
        throw error;
      }

      lastError = error;

      if (!isLast && isRetryableBybitError(error)) {
        continue;
      }

      throw error;
    }
  }

  throw lastError ?? new BybitApiError("Bybit request failed", { path });
}
