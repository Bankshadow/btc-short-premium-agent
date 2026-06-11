import { getUiBundle } from "@/lib/core/get-ui-bundle";
import { ReportsClient } from "./reports-client";

export default async function ReportsPage() {
  const initialUi = await getUiBundle();
  return <ReportsClient initialUi={initialUi} />;
}
