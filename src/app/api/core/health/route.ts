import { evaluateCoreHealth } from "@/lib/core/core-health";
import { getDefaultCoreHealth } from "@/lib/core/projection-defaults";
import { runProjectionRoute } from "@/lib/core/projection-route";

export async function GET() {
  return runProjectionRoute("health", getDefaultCoreHealth(), () => evaluateCoreHealth());
}
