import { buildDashboardUiContextSafe } from "@/lib/core/ui-context";
import { zeroDashboardUiContext } from "@/lib/core/ui-context-zero";
import { projectionApiFail, projectionApiOk } from "@/lib/core/projection-api-response";

export async function GET() {
  try {
    const context = await buildDashboardUiContextSafe();
    return projectionApiOk(context);
  } catch (err) {
    return projectionApiFail(
      zeroDashboardUiContext(),
      err instanceof Error ? err.message : "UI context failed",
    );
  }
}
