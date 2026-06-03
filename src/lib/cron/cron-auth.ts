import { NextResponse } from "next/server";

export function isCronSecretConfigured(): boolean {
  return Boolean(process.env.CRON_SECRET?.trim());
}

/** Dashboard test trigger — local dev by default; set ALLOW_TEST_AUTOMATION=true on Vercel to enable. */
export function isTestAutomationAllowed(): boolean {
  if (!isCronSecretConfigured()) return false;
  return (
    process.env.NODE_ENV === "development" ||
    process.env.ALLOW_TEST_AUTOMATION === "true"
  );
}

export function isTestModeRequest(request: Request): boolean {
  const url = new URL(request.url);
  if (url.searchParams.get("test") === "1") return true;
  return request.headers.get("x-test-mode") === "true";
}

export function verifyCronAuthorization(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured on the server." },
      { status: 503 },
    );
  }

  const authorization = request.headers.get("authorization");
  if (authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

export function verifyCronOrTestAuthorization(
  request: Request,
  test: boolean,
): NextResponse | null {
  if (!isCronSecretConfigured()) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured on the server." },
      { status: 503 },
    );
  }

  if (test) {
    if (!isTestAutomationAllowed()) {
      return NextResponse.json(
        {
          error:
            "Test automation is disabled. Set CRON_SECRET locally, or ALLOW_TEST_AUTOMATION=true on Vercel.",
        },
        { status: 403 },
      );
    }
    return null;
  }

  return verifyCronAuthorization(request);
}
