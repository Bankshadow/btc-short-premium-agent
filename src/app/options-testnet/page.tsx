import OptionsTestnetDashboard from "@/components/options-execution/OptionsTestnetDashboard";

export const metadata = {
  title: "BTC Options Testnet | Desk",
  description:
    "BTC options testnet-only execution — journaled orders on Bybit testnet. Production live blocked.",
};

export default function OptionsTestnetPage() {
  return <OptionsTestnetDashboard />;
}
