import type { AnalyzeApiResponse } from "@/lib/types/market";
import ActionPlanCard from "./ActionPlanCard";
import CheckFramework from "./CheckFramework";
import CombinationReadPanel from "./CombinationReadPanel";
import DashboardDisclaimer from "./DashboardDisclaimer";
import DashboardHeader from "./DashboardHeader";
import MarketSnapshot from "./MarketSnapshot";
import NoTradeRulesPanel from "./NoTradeRulesPanel";
import VerdictCard from "./VerdictCard";

interface HomeDashboardProps {
  data: AnalyzeApiResponse;
}

export default function HomeDashboard({ data }: HomeDashboardProps) {
  return (
    <div className="flex flex-col gap-6">
      <DashboardHeader
        analyzedAt={data.step5_verdict.analyzedAt}
        marketTimestamp={data.step1_marketSnapshot.timestamp}
      />

      <MarketSnapshot snapshot={data.step1_marketSnapshot} />

      <CheckFramework checks={data.step2_eightCheckFramework} />

      <NoTradeRulesPanel rules={data.step3_noTradeRules} />

      <CombinationReadPanel combinationRead={data.step4_combinationRead} />

      <div className="grid gap-6 lg:grid-cols-2">
        <VerdictCard
          verdict={data.step5_verdict}
          combinationRead={data.step4_combinationRead}
          showCombinationRead={false}
        />
        <ActionPlanCard
          verdict={data.step5_verdict}
          actionPlan={data.step6_actionPlan}
          noTradeRules={data.step3_noTradeRules}
        />
      </div>

      <DashboardDisclaimer />
    </div>
  );
}
