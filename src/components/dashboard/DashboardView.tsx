import type { AnalyzeApiResponse } from "@/lib/types/market";
import ActionPlanCard from "./ActionPlanCard";
import CheckFramework from "./CheckFramework";
import DashboardDisclaimer from "./DashboardDisclaimer";
import DashboardHeader from "./DashboardHeader";
import MarketSnapshot from "./MarketSnapshot";
import NoTradeRulesPanel from "./NoTradeRulesPanel";
import OptionSweetSpotTable from "./OptionSweetSpotTable";
import VerdictCard from "./VerdictCard";

interface DashboardViewProps {
  data: AnalyzeApiResponse;
}

export default function DashboardView({ data }: DashboardViewProps) {
  return (
    <>
      <DashboardHeader
        analyzedAt={data.step5_verdict.analyzedAt}
        marketTimestamp={data.step1_marketSnapshot.timestamp}
      />

      <MarketSnapshot snapshot={data.step1_marketSnapshot} />

      <OptionSweetSpotTable candidates={data.optionCandidates} />

      <CheckFramework checks={data.step2_eightCheckFramework} />

      <NoTradeRulesPanel rules={data.step3_noTradeRules} />

      <div className="grid gap-6 lg:grid-cols-2">
        <VerdictCard
          verdict={data.step5_verdict}
          actionPlan={data.step6_actionPlan}
          checks={data.step2_eightCheckFramework}
          noTradeRules={data.step3_noTradeRules}
          combinationRead={data.step4_combinationRead}
        />
        <ActionPlanCard
          verdict={data.step5_verdict}
          actionPlan={data.step6_actionPlan}
          noTradeRules={data.step3_noTradeRules}
        />
      </div>

      <DashboardDisclaimer />
    </>
  );
}
