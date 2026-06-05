import WarehouseDashboard from "@/components/warehouse/WarehouseDashboard";

export const metadata = {
  title: "Data Warehouse | BTC Desk",
  description:
    "Production data warehouse — durable source of truth for trading desk state.",
};

export default function WarehousePage() {
  return <WarehouseDashboard />;
}
