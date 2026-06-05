import LiveScaleUpDashboard from "@/components/live-scale-up/LiveScaleUpDashboard";

export const metadata = {
  title: "Live Scale-Up | BTC Desk",
  description:
    "Staged live perp scale-up framework — promotion requires approval, auto-demotion on risk breach.",
};

export default function LiveScaleUpPage() {
  return <LiveScaleUpDashboard />;
}
