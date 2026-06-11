import { getUiBundle } from "@/lib/core/get-ui-bundle";
import { CoreClient } from "./core-client";

export const dynamic = "force-dynamic";

export default async function CoreMonitorPage() {
  const initialUi = await getUiBundle();
  return <CoreClient initialUi={initialUi} />;
}
