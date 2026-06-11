import { getUiBundle } from "@/lib/core/get-ui-bundle";
import { CoreClient } from "./core-client";

export default async function CoreMonitorPage() {
  const initialUi = await getUiBundle();
  return <CoreClient initialUi={initialUi} />;
}
