import type { MissionFlowSnapshot } from "@/lib/mission-flow/types";

export default function GoalErrorBanner({
  error,
  degraded,
  warnings,
  snapshot,
}: {
  error?: string | null;
  degraded?: boolean;
  warnings?: string[];
  snapshot?: MissionFlowSnapshot;
}) {
  const items: { tone: "rose" | "amber"; text: string }[] = [];

  if (error) items.push({ tone: "rose", text: error });
  if (degraded && warnings?.length) {
    for (const w of warnings) items.push({ tone: "amber", text: w });
  }
  if (snapshot?.risk.blocker) {
    items.push({ tone: "rose", text: `Blocker: ${snapshot.risk.blocker}` });
  }
  if (
    snapshot?.binanceTestnet.status === "BLOCKED" ||
    snapshot?.binanceTestnet.status === "DISCONNECTED"
  ) {
    items.push({
      tone: "amber",
      text: `Binance testnet ${snapshot.binanceTestnet.status}: ${snapshot.binanceTestnet.reason}`,
    });
  }

  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <p
          key={item.text}
          className={`rounded-lg border px-4 py-2 text-xs ${
            item.tone === "rose"
              ? "border-rose-900/50 bg-rose-950/30 text-rose-200"
              : "border-amber-900/50 bg-amber-950/25 text-amber-200"
          }`}
        >
          {item.text}
        </p>
      ))}
    </div>
  );
}
