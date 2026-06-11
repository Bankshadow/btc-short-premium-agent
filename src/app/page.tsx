import { getUiBundle } from "@/lib/core/get-ui-bundle";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const initialUi = await getUiBundle();
  return <DashboardClient initialUi={initialUi} />;
}
