import { buildMissionFlowServerSnapshot } from "@/lib/mission-flow/build-server-snapshot";
import { getDailySelfReviewStatus } from "@/lib/daily-self-review/run-daily-self-review";
import { loadTradeBlackBoxStore } from "@/lib/trade-black-box/black-box-store";
import type { ImprovementProposal } from "./types";

function isTodayUtc(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const n = new Date();
  return (
    d.getUTCFullYear() === n.getUTCFullYear() &&
    d.getUTCMonth() === n.getUTCMonth() &&
    d.getUTCDate() === n.getUTCDate()
  );
}

export async function verifyImprovementAfterDeploy(
  proposal: ImprovementProposal,
): Promise<{ passed: boolean; summary: string; checks: string[] }> {
  const checks: string[] = [];
  const { snapshot } = await buildMissionFlowServerSnapshot({ fresh: true });

  switch (proposal.issueType) {
    case "TESTNET_FAILURE": {
      const connected = snapshot.binanceTestnet.status === "CONNECTED";
      checks.push(
        connected
          ? "Binance testnet connected."
          : `Testnet still ${snapshot.binanceTestnet.status}: ${snapshot.binanceTestnet.reason}`,
      );
      const store = await loadTradeBlackBoxStore();
      const sameFingerprint = store.records.filter(
        (r) =>
          r.failureCause.category !== "NONE" &&
          proposal.detectedIssue.evidence.some((e) =>
            r.failureCause.evidence.includes(e),
          ),
      );
      checks.push(
        sameFingerprint.length === 0
          ? "No matching black-box failures in recent store."
          : `${sameFingerprint.length} similar failure(s) still recorded.`,
      );
      const passed = connected && sameFingerprint.length === 0;
      return {
        passed,
        summary: passed
          ? "Testnet path appears healthy after deploy."
          : "Testnet verification failed — recheck connection and recent failures.",
        checks,
      };
    }

    case "DATA_NOT_FLOWING": {
      const engines = snapshot.enginesNeedingAttention;
      checks.push(
        engines === 0
          ? "No engines needing attention."
          : `${engines} engine(s) still need attention.`,
      );
      const passed = engines === 0;
      return {
        passed,
        summary: passed
          ? "Data/engine health improved."
          : "Data flow issue may persist — inspect /data and analyze trust.",
        checks,
      };
    }

    case "STRATEGY_WEAKNESS": {
      const health = snapshot.strategyHealth;
      const allowed = health?.tradeAllowed !== false;
      checks.push(
        allowed
          ? "Primary strategy tradeAllowed."
          : `Strategy still blocked: ${health?.blockReason ?? "unknown"}`,
      );
      return {
        passed: allowed,
        summary: allowed
          ? "Strategy health gate open or documented."
          : "Strategy weakness may persist.",
        checks,
      };
    }

    case "REPORT_MISSING": {
      const daily = await getDailySelfReviewStatus();
      const hasToday = isTodayUtc(daily.lastRunAt);
      checks.push(
        hasToday
          ? "Daily self-review ran today."
          : "Daily self-review still missing for UTC day.",
      );
      return {
        passed: hasToday,
        summary: hasToday
          ? "Report pipeline verified."
          : "Run /api/daily-self-review/run and confirm /reports.",
        checks,
      };
    }

    case "RISK_GAP": {
      const blocker = snapshot.risk.blocker;
      checks.push(blocker ? `Risk blocker remains: ${blocker}` : "No mission risk blocker.");
      return {
        passed: !blocker,
        summary: blocker
          ? "Risk gap may persist."
          : "Risk blocker cleared.",
        checks,
      };
    }

    case "UX_ISSUE":
    default:
      checks.push("UX fixes require operator smoke test on affected pages.");
      checks.push(`Review: ${proposal.affectedPages.join(", ")}`);
      return {
        passed: true,
        summary:
          "Advisory verification — operator should confirm UX improvement manually.",
        checks,
      };
  }
}
