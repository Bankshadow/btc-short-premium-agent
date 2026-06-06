import BinanceTestnetDashboard from "@/components/binance-execution/BinanceTestnetDashboard";

export const metadata = {
  title: "Binance Futures Testnet | Desk",
  description:
    "Binance USD-M Futures testnet-only execution. Production Binance live trading is disabled.",
};

export default function BinanceTestnetPage() {
  return <BinanceTestnetDashboard />;
}
