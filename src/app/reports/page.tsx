import { getUiBundle } from "@/lib/core/get-ui-bundle";
import { ReportsClient } from "./reports-client";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const initialUi = await getUiBundle();
  return <ReportsClient initialUi={initialUi} />;
}
