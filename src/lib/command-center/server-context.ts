import { buildServerReadinessContext } from "@/lib/live-readiness/server-context";

/** Server-only context for command center (exchange, alerts env, live gate). */
export async function buildCommandCenterServerContext() {
  return buildServerReadinessContext();
}
