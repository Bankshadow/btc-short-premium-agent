const BYBIT_BASE_URL = "https://api.bybit.com";

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

  constructor(
    message: string,
    options: {
      status?: number;
      retCode?: number;
      retMsg?: string;
      path: string;
      cause?: unknown;
    },
  ) {
    super(message, { cause: options.cause });
    this.name = "BybitApiError";
    this.status = options.status;
    this.retCode = options.retCode;
    this.retMsg = options.retMsg;
    this.path = options.path;
  }
}

/**
 * Read-only Bybit public API client.
 * Analysis-only — no authenticated or trading endpoints.
 */
export async function bybitGet<T>(
  path: string,
  params?: Record<string, string | number>,
): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(normalizedPath, BYBIT_BASE_URL);

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
      },
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Network request failed";
    throw new BybitApiError(`Bybit request failed: ${normalizedPath} (${detail})`, {
      path: normalizedPath,
      cause: error,
    });
  }

  if (!response.ok) {
    throw new BybitApiError(
      `Bybit HTTP ${response.status}: ${response.statusText}`,
      {
        status: response.status,
        path: normalizedPath,
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
      },
    );
  }

  return body.result;
}
