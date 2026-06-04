import type { AnalyzeApiResponse } from "@/lib/types/market";
import ActionPlanCard from "./ActionPlanCard";
import CheckFramework from "./CheckFramework";
import DashboardDisclaimer from "./DashboardDisclaimer";
import DashboardHeader from "./DashboardHeader";
import MarketSnapshot from "./MarketSnapshot";
import NoTradeRulesPanel from "./NoTradeRulesPanel";
import OptionSweetSpotTable from "./OptionSweetSpotTable";
import TradingDeskView from "./trading-desk/TradingDeskView";
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

      {data.tradingDesk && <TradingDeskView desk={data.tradingDesk} />}

      <details className="group rounded-xl border border-zinc-200 dark:border-zinc-800">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-300 [&::-webkit-details-marker]:hidden">
          Playbook engine detail (options · checks · rules)
          <span className="ml-2 text-zinc-400 group-open:hidden">▸</span>
          <span className="ml-2 text-zinc-400 hidden group-open:inline">▾</span>
        </summary>
        <div className="flex flex-col gap-6 border-t border-zinc-200 px-4 pb-4 pt-4 dark:border-zinc-800">
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
        </div>
      </details>
    </>
  );
}
