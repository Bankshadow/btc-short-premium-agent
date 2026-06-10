/**
 * Advisory post-close loop — chains journal updates after PNL_REALIZED.
 * No orders; Event Journal remains source of truth.
 */
async function runPostTradeStep(
  tradeId: string,
  phase: string,
  fn: () => Promise<void>,
): Promise<void> {
  try {
    await fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const { appendEvent } = await import("@/lib/journal/journal-query");
    await appendEvent({
      type: "ERROR_RECORDED",
      environment: "testnet",
      tradeId,
      payload: { phase: `POST_TRADE_LOOP_${phase}`, message },
    });
  }
}

export async function runPostTradeLoop(tradeId: string): Promise<void> {
  await runPostTradeStep(tradeId, "LEARNING", async () => {
    const { createLearningRecord } = await import("@/lib/learning/create-learning-record");
    await createLearningRecord({ tradeId });
  });

  await runPostTradeStep(tradeId, "EVIDENCE", async () => {
    const { recalculateEvidenceProgress } = await import("@/lib/evidence/evidence-progress");
    await recalculateEvidenceProgress();
  });

  await runPostTradeStep(tradeId, "STRATEGY_HEALTH", async () => {
    const { calculateStrategyHealth } = await import("@/lib/strategy/strategy-health");
    await calculateStrategyHealth();
  });

  await runPostTradeStep(tradeId, "AGENT_SCORES", async () => {
    const { updateAgentScoresForTrade } = await import("@/lib/agents/agent-scoreboard");
    await updateAgentScoresForTrade(tradeId);
  });

  await runPostTradeStep(tradeId, "PORTFOLIO_RISK", async () => {
    const { evaluatePortfolioRisk } = await import("@/lib/portfolio-risk/portfolio-risk-manager");
    await evaluatePortfolioRisk();
  });

  await runPostTradeStep(tradeId, "SESSION_REPLAY", async () => {
    const { createSessionReplay } = await import("@/lib/replay/session-replay");
    await createSessionReplay(tradeId);
  });

  await runPostTradeStep(tradeId, "DAILY_BRIEFING", async () => {
    const { createDailyBriefing } = await import("@/lib/briefing/daily-briefing");
    await createDailyBriefing();
  });

  await runPostTradeStep(tradeId, "AUDIT_PACK", async () => {
    const { generateAuditPack } = await import("@/lib/audit/audit-pack-generator");
    await generateAuditPack();
  });
}
