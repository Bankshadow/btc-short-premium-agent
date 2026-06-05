import type { AnalyzeApiResponse } from "@/lib/types/market";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { GovernanceDeskState, DeskIncident } from "@/lib/governance/governance-types";
import type { PreMortemResult } from "@/lib/mortem/types";
import { evaluateKillSwitch } from "@/lib/validation/kill-switch";
import { LIQUIDATION_SKIP } from "@/lib/decision/thresholds";
import { preMortemBlocksTicket } from "@/lib/mortem/apply-mortem-layer";
import { loadOptionsExecutionConfig } from "./config";
import type {
  OptionsInstrument,
  OptionsMarginEstimate,
  OptionsOrderTicket,
  OptionsRiskCheck,
} from "./types";
import type { OptionsPreviewJournalEntry } from "./types";

function check(
  id: string,
  label: string,
  status: OptionsRiskCheck["status"],
  message: string,
  blocking: boolean,
): OptionsRiskCheck {
  return { id, label, status, message, blocking };
}

export function runOptionsRiskChecks(input: {
  ticket: OptionsOrderTicket | null;
  instrument: OptionsInstrument | null;
  margin: OptionsMarginEstimate;
  data?: AnalyzeApiResponse | null;
  entries?: DecisionLogEntry[];
  orders?: PaperOrder[];
  governance?: GovernanceDeskState;
  incidents?: DeskIncident[];
  journal?: OptionsPreviewJournalEntry[];
  preMortem?: PreMortemResult | null;
}): OptionsRiskCheck[] {
  const config = loadOptionsExecutionConfig();
  const checks: OptionsRiskCheck[] = [];

  checks.push(
    check(
      "preview_only",
      "Preview-only mode",
      "PASS",
      "Real BTC options live execution is disabled (MVP 27).",
      false,
    ),
  );

  if (config.liveEnabled) {
    checks.push(
      check(
        "live_not_implemented",
        "OPTIONS_LIVE_ENABLED",
        "FAIL",
        "OPTIONS_LIVE_ENABLED=true but live execution not implemented — blocked.",
        true,
      ),
    );
  }

  if (!input.instrument?.mapped) {
    checks.push(
      check(
        "instrument_map",
        "Instrument mapping",
        "FAIL",
        input.instrument?.mappingErrors.join("; ") || "Unmapped instrument.",
        true,
      ),
    );
  } else {
    checks.push(
      check(
        "instrument_map",
        "Instrument mapping",
        "PASS",
        `Mapped ${input.instrument.symbol} · ${input.instrument.optionType} · strike ${input.instrument.strike}`,
        false,
      ),
    );
  }

  if (!config.nakedAllowed) {
    checks.push(
      check(
        "naked_options",
        "Naked short options",
        "FAIL",
        "Naked live options blocked — set OPTIONS_NAKED_ALLOWED=true to allow testnet prep.",
        true,
      ),
    );
  } else {
    checks.push(
      check(
        "naked_options",
        "Naked short options",
        "WARNING",
        "OPTIONS_NAKED_ALLOWED=true — short premium naked risk acknowledged.",
        false,
      ),
    );
  }

  const notional = input.ticket?.notionalUsd ?? 0;
  if (notional > config.maxNotionalUsd) {
    checks.push(
      check(
        "max_notional",
        "Max notional",
        "FAIL",
        `$${notional.toFixed(2)} exceeds OPTIONS_MAX_NOTIONAL_USD ($${config.maxNotionalUsd}).`,
        true,
      ),
    );
  } else {
    checks.push(
      check(
        "max_notional",
        "Max notional",
        "PASS",
        `$${notional.toFixed(2)} within $${config.maxNotionalUsd} cap.`,
        false,
      ),
    );
  }

  if (
    input.margin.marginUsagePct != null &&
    input.margin.marginUsagePct > config.maxMarginPct
  ) {
    checks.push(
      check(
        "max_margin",
        "Max margin usage",
        "FAIL",
        `Margin usage ${input.margin.marginUsagePct}% exceeds ${config.maxMarginPct}% cap.`,
        true,
      ),
    );
  } else if (input.margin.sufficient === false) {
    checks.push(
      check(
        "max_margin",
        "Margin sufficient",
        "FAIL",
        "Insufficient margin for estimated premium.",
        true,
      ),
    );
  } else {
    checks.push(
      check(
        "max_margin",
        "Margin estimate",
        "PASS",
        `Est. margin $${input.margin.estimatedMarginUsd.toFixed(2)}.`,
        false,
      ),
    );
  }

  const openCount = (input.journal ?? []).filter(
    (j) => j.valid && j.status !== "REJECTED",
  ).length;
  if (openCount >= config.maxOpenPositions) {
    checks.push(
      check(
        "max_open",
        "Max open previews",
        "FAIL",
        `${openCount} active previews ≥ limit ${config.maxOpenPositions}.`,
        true,
      ),
    );
  }

  const data = input.data;
  if (data?.macroEvent?.hasEventBeforeSettlement) {
    checks.push(
      check(
        "macro_event",
        "Macro event",
        "FAIL",
        `Macro event before settlement: ${data.macroEvent.eventName ?? "scheduled"}.`,
        true,
      ),
    );
  } else {
    checks.push(
      check("macro_event", "Macro event", "PASS", "No macro block before settlement.", false),
    );
  }

  const liq = data?.liquidation?.liquidation24h;
  if (liq != null && liq > LIQUIDATION_SKIP) {
    checks.push(
      check(
        "liquidation",
        "Liquidation proximity",
        "FAIL",
        `24h liquidations $${(liq / 1e6).toFixed(0)}M exceed cascade threshold.`,
        true,
      ),
    );
  } else {
    checks.push(
      check("liquidation", "Liquidation regime", "PASS", "No liquidation cascade block.", false),
    );
  }

  const dt = data?.dataTrust;
  if (dt?.grade === "CRITICAL" || (dt && !dt.tradeAllowed)) {
    checks.push(
      check(
        "data_trust",
        "Data trust",
        "FAIL",
        `Data trust ${dt.grade} (${dt.score}/100) — live prep blocked.`,
        true,
      ),
    );
  } else if (dt?.grade === "LOW") {
    checks.push(
      check(
        "data_trust",
        "Data trust",
        "WARNING",
        `Data trust LOW (${dt.score}/100).`,
        false,
      ),
    );
  } else {
    checks.push(
      check(
        "data_trust",
        "Data trust",
        "PASS",
        dt ? `${dt.grade} (${dt.score}/100)` : "No analyze snapshot — run desk first.",
        false,
      ),
    );
  }

  const gov = input.governance;
  if (gov?.operatorPaused || gov?.safeMode || gov?.pauseAnalysis) {
    checks.push(
      check(
        "governance",
        "Governance pause",
        "FAIL",
        "Governance kill switch / pause active.",
        true,
      ),
    );
  }

  const kill = evaluateKillSwitch({
    entries: input.entries ?? [],
    orders: input.orders ?? [],
    riskProfile: "balanced",
    latestAnalysis: data ?? undefined,
  });
  if (kill.tradingPaused) {
    checks.push(
      check(
        "kill_switch",
        "Kill switch",
        "FAIL",
        kill.messages.join(" ") || "Trading paused.",
        true,
      ),
    );
  } else {
    checks.push(check("kill_switch", "Kill switch", "PASS", "Clear.", false));
  }

  if (preMortemBlocksTicket(input.preMortem)) {
    checks.push(
      check(
        "pre_mortem",
        "Pre-mortem",
        "FAIL",
        input.preMortem?.topFailureReason ?? "Pre-mortem blocks ticket.",
        true,
      ),
    );
  } else if (input.preMortem) {
    checks.push(
      check(
        "pre_mortem",
        "Pre-mortem",
        input.preMortem.preMortemVerdict === "CAUTION" ? "WARNING" : "PASS",
        input.preMortem.topFailureReason,
        false,
      ),
    );
  }

  const critical = (input.incidents ?? []).filter(
    (i) =>
      i.severity === "critical" &&
      (i.status === "open" || i.status === "investigating"),
  );
  if (critical.length > 0) {
    checks.push(
      check(
        "incidents",
        "Critical incidents",
        "FAIL",
        `${critical.length} unresolved critical incident(s).`,
        true,
      ),
    );
  }

  if (input.instrument && input.instrument.spreadPct > 10) {
    checks.push(
      check(
        "liquidity",
        "Liquidity / spread",
        "WARNING",
        `Bid-ask spread ${input.instrument.spreadPct}% — slippage risk.`,
        false,
      ),
    );
  }

  return checks;
}

export function summarizeRiskChecks(checks: OptionsRiskCheck[]): {
  blockingReasons: string[];
  warnings: string[];
  valid: boolean;
} {
  const blockingReasons = checks.filter((c) => c.blocking).map((c) => c.message);
  const warnings = checks
    .filter((c) => c.status === "WARNING" && !c.blocking)
    .map((c) => c.message);
  return {
    blockingReasons,
    warnings,
    valid: blockingReasons.length === 0,
  };
}
