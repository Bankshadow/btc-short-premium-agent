import OptionsDryRunDashboard from "@/components/options-dry-run/OptionsDryRunDashboard";

export const metadata = {
  title: "Options Dry-Run | BTC Desk",
  description:
    "BTC options live dry-run gate — would-be-live checks without sending real orders.",
};

export default function OptionsDryRunPage() {
  return <OptionsDryRunDashboard />;
}
