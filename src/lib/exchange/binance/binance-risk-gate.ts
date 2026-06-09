import type { CommandCenterStatus } from "@/lib/command-center/types";
import type { GovernanceDeskState } from "@/lib/governance/governance-types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import { isTestnetPrimaryAutomation } from "@/lib/automation-control-plane/primary-mode";
import { getDeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import { evaluateKillSwitch } from "@/lib/validation/kill-switch";
import {
  assertBinanceTestnetOnly,
  blockBinanceProductionOrder,
  isBinanceForceMaxAutopilotEnabled,
  loadBinanceConfig,
} from "./binance-config";
import type {
  BinanceOrderPreview,
  BinancePosition,
  BinanceRiskCheck,
  BinanceTestnetJournalEntry,
} from "./binance-types";

export interface BinanceRiskGateContext {
  preview?: BinanceOrderPreview | null;
  positions?: BinancePosition[];
  journal?: BinanceTestnetJournalEntry[];
  commandCenterStatus?: CommandCenterStatus | string | null;
  governance?: GovernanceDeskState | null;
  entries?: DecisionLogEntry[];
  orders?: PaperOrder[];
  doubleConfirm?: boolean;
}

function check(
  id: string,
  label: string,
  pass: boolean,
  failMessage: string,
  blocking = true,
): BinanceRiskCheck {
  return {
    id,
    label,
    status: pass ? "PASS" : blocking ? "FAIL" : "WARNING",
    message: pass ? "OK" : failMessage,
    blocking: !pass && blocking,
  };
}

export function validateOrderAgainstRiskGate(
  ctx: BinanceRiskGateContext,
): { blocked: boolean; blockReasons: string[]; riskChecks: BinanceRiskCheck[] } {
  const config = loadBinanceConfig();
  const checks: BinanceRiskCheck[] = [];
  const blockReasons: string[] = [];

  const productionBlock = blockBinanceProductionOrder();
  checks.push(
    check(
      "production_block",
      "Production blocked",
      !productionBlock,
      productionBlock ?? "OK",
    ),
  );
  if (productionBlock) blockReasons.push(productionBlock);

  const testnetGate = assertBinanceTestnetOnly();
  checks.push(
    check(
      "testnet_enabled",
      "Testnet enabled",
      testnetGate.allowed,
      testnetGate.blockers[0] ?? "Testnet not enabled",
    ),
  );
  if (!testnetGate.allowed) blockReasons.push(...testnetGate.blockers);

  if (config.liveEnabled) {
    const msg = "BINANCE_LIVE_ENABLED must remain false.";
    checks.push(check("live_disabled", "Live disabled", false, msg));
    blockReasons.push(msg);
  } else {
    checks.push(check("live_disabled", "Live disabled", true, "OK"));
  }

  const preview = ctx.preview;
  if (preview) {
    const symbolAllowed = config.allowedSymbols.includes(
      preview.symbol.toUpperCase(),
    );
    checks.push(
      check(
        "symbol_allowlist",
        "Symbol allowlist",
        symbolAllowed,
        `${preview.symbol} not in BINANCE_ALLOWED_SYMBOLS`,
      ),
    );
    if (!symbolAllowed) {
      blockReasons.push(`${preview.symbol} not in allowlist`);
    }

    const notionalOk = preview.notionalUsd <= config.maxNotionalUsd;
    checks.push(
      check(
        "max_notional",
        "Max notional",
        notionalOk,
        `Notional $${preview.notionalUsd} exceeds max $${config.maxNotionalUsd}`,
      ),
    );
    if (!notionalOk) {
      blockReasons.push(`Notional exceeds $${config.maxNotionalUsd}`);
    }

    const expired = Date.now() > Date.parse(preview.expiresAt);
    checks.push(
      check(
        "preview_expiry",
        "Preview not expired",
        !expired,
        "Preview expired — rebuild preview",
      ),
    );
    if (expired) blockReasons.push("Preview expired");

    if (config.requireDoubleConfirm) {
      const confirmed = ctx.doubleConfirm === true;
      checks.push(
        check(
          "double_confirm",
          "Double confirmation",
          confirmed,
          "BINANCE_REQUIRE_DOUBLE_CONFIRM — doubleConfirm must be true",
        ),
      );
      if (!confirmed) blockReasons.push("Double confirmation required");
    }
  }

  const journal = ctx.journal ?? [];
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tradesToday = journal.filter(
    (j) =>
      new Date(j.createdAt).getTime() >= todayStart.getTime() &&
      j.status !== "BLOCKED" &&
      j.status !== "PREVIEWED",
  ).length;
  const dailyOk = tradesToday < config.maxTradesPerDay;
  checks.push(
    check(
      "daily_trades",
      "Daily trade limit",
      dailyOk,
      `Daily limit ${config.maxTradesPerDay} reached (${tradesToday} today)`,
    ),
  );
  if (!dailyOk) {
    blockReasons.push(`Max ${config.maxTradesPerDay} testnet trades per day`);
  }

  const positions = ctx.positions ?? [];
  const openCount = positions.filter(
    (p) => Math.abs(Number(p.positionAmt)) > 0,
  ).length;
  const openOk = openCount < config.maxOpenPositions;
  checks.push(
    check(
      "max_open_positions",
      "Max open positions",
      openOk,
      `Max ${config.maxOpenPositions} open position(s) — ${openCount} open`,
    ),
  );
  if (!openOk) {
    blockReasons.push(`Max ${config.maxOpenPositions} open positions`);
  }

  const kill = evaluateKillSwitch({
    entries: ctx.entries ?? [],
    orders: ctx.orders ?? [],
    riskProfile: getDeskRiskProfile(),
  });
  const killOk = !kill.tradingPaused;
  checks.push(
    check(
      "kill_switch",
      "Kill switch",
      killOk,
      kill.tradingPaused ? `Kill switch: ${kill.messages[0] ?? "active"}` : "OK",
    ),
  );
  if (!killOk) blockReasons.push(kill.messages[0] ?? "Kill switch active");

  const cc = ctx.commandCenterStatus;
  const skipCommandCenterBlock =
    isBinanceForceMaxAutopilotEnabled() || isTestnetPrimaryAutomation();
  if (
    cc &&
    (cc === "BLOCKED" || cc === "EMERGENCY") &&
    !skipCommandCenterBlock
  ) {
    const msg = `Command center ${cc} — testnet execution blocked`;
    checks.push(check("command_center", "Command center", false, msg));
    blockReasons.push(msg);
  } else {
    checks.push(check("command_center", "Command center", true, "OK"));
  }

  if (ctx.governance?.operatorPaused) {
    const msg = "Governance operator pause active";
    checks.push(check("governance_pause", "Governance pause", false, msg));
    blockReasons.push(msg);
  } else {
    checks.push(check("governance_pause", "Governance pause", true, "OK"));
  }

  const blocked = blockReasons.length > 0;
  return { blocked, blockReasons, riskChecks: checks };
}
