import { runUiConsistencyCheck } from "@/lib/core/ui-consistency-check";
import { projectionApiFail, projectionApiOk } from "@/lib/core/projection-api-response";

const ZERO_CONSISTENCY = {
  status: "OK" as const,
  checks: [],
  mismatches: [],
  lastCheckedAt: new Date().toISOString(),
};

export async function GET() {
  try {
    const report = await runUiConsistencyCheck();
    return projectionApiOk(report);
  } catch (err) {
    return projectionApiFail(
      ZERO_CONSISTENCY,
      err instanceof Error ? err.message : "UI consistency check failed",
    );
  }
}
