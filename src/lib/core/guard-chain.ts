import { checkCloseSafetyGuard } from "./guards/close-safety-guard";
import { checkCoreHealthGuard } from "./guards/core-health-guard";
import { checkEngineHealthGuard } from "./guards/engine-health-guard";
import { checkExecutionSafetyGuard } from "./guards/execution-safety-guard";
import { checkLiveLockGuard } from "./guards/live-lock-guard";
import { checkNoTradeRuleGuard } from "./guards/no-trade-rule-guard";
import { checkOperatorGuard } from "./guards/operator-guard";
import { checkPortfolioRiskGuard } from "./guards/portfolio-risk-guard";
import { checkReduceOnlyGuard } from "./guards/reduce-only-guard";
import { checkRiskModeGuard } from "./guards/risk-mode-guard";

export interface GuardChainBlocker {
  code: string;
  message: string;
  guard: string;
  requiredAction?: string;
}

export interface GuardChainResult {
  allowed: boolean;
  blockers: GuardChainBlocker[];
  liveLocked: true;
}

export interface ExecuteGuardChainInput {
  previewId: string;
  doubleConfirm: boolean;
  runId?: string;
  decisionLogId?: string;
}

export interface CloseGuardChainInput {
  closePreviewId: string;
  doubleConfirm: boolean;
  reduceOnly?: boolean;
  runId?: string;
  decisionLogId?: string;
}

function block(
  guard: string,
  code: string,
  message: string,
  requiredAction?: string,
): GuardChainBlocker {
  return { guard, code, message, requiredAction };
}

export async function runExecuteGuardChain(
  input: ExecuteGuardChainInput,
): Promise<GuardChainResult> {
  const blockers: GuardChainBlocker[] = [];

  const operator = await checkOperatorGuard();
  if (operator.blocked) {
    blockers.push(block("operator", "OPERATOR_BLOCKED", operator.reason ?? "Operator blocked."));
  }

  const live = checkLiveLockGuard();
  if (live.blocked) {
    blockers.push(block("live-lock", "LIVE_ENVIRONMENT_BLOCKED", live.reason ?? "Live locked."));
  }

  const engine = await checkEngineHealthGuard();
  if (engine.blocked) {
    blockers.push(block("engine-health", "ENGINE_HEALTH_BLOCKED", engine.reason ?? "Engine health blocked."));
  }

  const core = await checkCoreHealthGuard();
  if (core.blocked) {
    blockers.push(block("core-health", "CORE_HEALTH_BLOCKED", core.reason ?? "Core health blocked."));
  }

  const portfolio = await checkPortfolioRiskGuard();
  if (portfolio.blocked) {
    blockers.push(
      block("portfolio-risk", "PORTFOLIO_RISK_BLOCKED", portfolio.reason ?? "Portfolio risk blocked."),
    );
  }

  const riskMode = await checkRiskModeGuard("execute");
  if (riskMode.blocked) {
    blockers.push(block("risk-mode", "RISK_MODE_CONSERVATIVE", riskMode.reason ?? "Conservative risk mode."));
  }

  const rules = await checkNoTradeRuleGuard();
  if (rules.blocked) {
    blockers.push(block("no-trade-rule", "NO_TRADE_RULE_TRIGGERED", rules.reason ?? "No-trade rule."));
  }

  if (blockers.length > 0) {
    return { allowed: false, blockers, liveLocked: true };
  }

  const safety = await checkExecutionSafetyGuard({
    previewId: input.previewId,
    doubleConfirm: input.doubleConfirm,
  });

  if (!safety.allowed) {
    for (const b of safety.blockers) {
      blockers.push(
        block("execution-safety", b.code, b.message, b.requiredAction),
      );
    }
    return { allowed: false, blockers, liveLocked: true };
  }

  return { allowed: true, blockers: [], liveLocked: true };
}

export async function runCloseGuardChain(
  input: CloseGuardChainInput,
): Promise<GuardChainResult> {
  const blockers: GuardChainBlocker[] = [];

  const operator = await checkOperatorGuard();
  if (operator.blocked) {
    blockers.push(block("operator", "OPERATOR_BLOCKED", operator.reason ?? "Operator blocked."));
  }

  const live = checkLiveLockGuard();
  if (live.blocked) {
    blockers.push(block("live-lock", "LIVE_ENVIRONMENT_BLOCKED", live.reason ?? "Live locked."));
  }

  const engine = await checkEngineHealthGuard();
  if (engine.blocked) {
    blockers.push(block("engine-health", "ENGINE_HEALTH_BLOCKED", engine.reason ?? "Engine health blocked."));
  }

  const core = await checkCoreHealthGuard();
  if (core.blocked) {
    blockers.push(block("core-health", "CORE_HEALTH_BLOCKED", core.reason ?? "Core health blocked."));
  }

  const reduceOnly = checkReduceOnlyGuard({ reduceOnly: input.reduceOnly });
  if (reduceOnly.blocked) {
    blockers.push(block("reduce-only", "REDUCE_ONLY_REQUIRED", reduceOnly.reason ?? "reduceOnly required."));
  }

  if (blockers.length > 0) {
    return { allowed: false, blockers, liveLocked: true };
  }

  const safety = await checkCloseSafetyGuard({
    closePreviewId: input.closePreviewId,
    doubleConfirm: input.doubleConfirm,
  });

  if (!safety.allowed) {
    for (const b of safety.blockers) {
      blockers.push(block("close-safety", b.code, b.message, b.requiredAction));
    }
    return { allowed: false, blockers, liveLocked: true };
  }

  return { allowed: true, blockers: [], liveLocked: true };
}
