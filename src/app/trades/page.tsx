import { getUiBundle } from "@/lib/core/get-ui-bundle";
import { TradesClient } from "./trades-client";

export const dynamic = "force-dynamic";

export default async function TradesPage() {
  const initialUi = await getUiBundle();
  return <TradesClient initialUi={initialUi} />;
}
