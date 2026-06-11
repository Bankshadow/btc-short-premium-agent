import { runProjectionParityCheck } from "@/lib/core/projection-parity";
import { projectionApiFail, projectionApiOk } from "@/lib/core/projection-api-response";

const ZERO_PARITY = {
  status: "WARNING" as const,
  eventCount: 0,
  checkedSections: [] as string[],
  parityIssues: [] as Array<{ id: string; ok: boolean; message: string }>,
  skippedChecks: [] as string[],
  checks: [] as Array<{ id: string; ok: boolean; message: string }>,
  mismatches: [] as Array<{ id: string; ok: boolean; message: string }>,
  lastCheckedAt: new Date().toISOString(),
};

export async function GET() {
  try {
    const report = await runProjectionParityCheck();
    return projectionApiOk(report);
  } catch (err) {
    return projectionApiFail(
      ZERO_PARITY,
      err instanceof Error ? err.message : "Parity check failed",
    );
  }
}
