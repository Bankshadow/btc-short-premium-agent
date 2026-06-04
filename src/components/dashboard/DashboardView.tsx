import type { AnalyzeApiResponse } from "@/lib/types/market";
import ActionPlanCard from "./ActionPlanCard";
import CheckFramework from "./CheckFramework";
import DashboardDisclaimer from "./DashboardDisclaimer";
import MarketSnapshot from "./MarketSnapshot";
import NoTradeRulesPanel from "./NoTradeRulesPanel";
import OptionSweetSpotTable from "./OptionSweetSpotTable";
import TradingDeskView from "./trading-desk/TradingDeskView";
import VerdictCard from "./VerdictCard";

interface DashboardViewProps {
  data: AnalyzeApiResponse;
  onMemoryPinsChange?: () => void;
}

export default function DashboardView({
  data,
  onMemoryPinsChange,
}: DashboardViewProps) {
  return (
    <>
      {data.tradingDesk && (
        <TradingDeskView
          desk={data.tradingDesk}
          onPinsChange={onMemoryPinsChange}
        />
      )}

      <details className="desk-panel group">
        <summary className="cursor-pointer list-none px-4 py-3 text-xs font-medium text-zinc-400 [&::-webkit-details-marker]:hidden">
          Playbook engine · market data · checks
          <span className="ml-2 opacity-50 group-open:hidden">▸</span>
          <span className="ml-2 hidden opacity-50 group-open:inline">▾</span>
        </summary>
        <div className="flex flex-col gap-4 border-t border-zinc-800 px-4 pb-4 pt-4">
          <MarketSnapshot snapshot={data.step1_marketSnapshot} />
          <OptionSweetSpotTable candidates={data.optionCandidates} />
          <CheckFramework checks={data.step2_eightCheckFramework} />
          <NoTradeRulesPanel rules={data.step3_noTradeRules} />
          <div className="grid gap-4 lg:grid-cols-2">
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
