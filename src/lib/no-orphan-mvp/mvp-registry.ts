import type { MvpIntegrationCheck, MvpIntegrationContract } from "./types";

function check(
  kind: MvpIntegrationCheck["kind"],
  label: string,
  paths: string[],
  options: { mustContain?: string; required?: boolean } = {},
): MvpIntegrationCheck {
  return {
    kind,
    label,
    paths,
    mustContain: options.mustContain,
    required: options.required ?? true,
  };
}

/** Registered integrated MVPs — add new entries here before shipping UI-only features. */
export const MVP_INTEGRATION_REGISTRY: MvpIntegrationContract[] = [
  {
    mvpId: 73,
    name: "Evidence Progress + Learning Queue",
    tradeAffecting: false,
    missionSnapshotField: "evidenceProgress",
    testnetSnapshotField: "learningProgress",
    journalEventType: "LEARNING_UPDATED",
    checks: [
      check("route_or_api", "Learning queue API", ["src/app/api/learning-queue/route.ts"]),
      check("data_source", "Build from journal", [
        "src/lib/learning-queue/build-learning-progress.ts",
        "src/lib/evidence-progress/build-evidence-progress.ts",
      ]),
      check("write_path", "Learning records server", [
        "src/lib/testnet-monitor/learning-records-server.ts",
      ]),
      check("dashboard_visibility", "Dashboard learning panel", [
        "src/components/goal/GoalDashboard.tsx",
      ], { mustContain: "LearningQueuePanel" }),
      check("reports_visibility", "Reports learning section", [
        "src/components/goal/ReportsView.tsx",
      ], { mustContain: "LearningQueuePanel" }),
      check("journal_event", "Learning updated event", [
        "src/lib/testnet-monitor/types.ts",
      ], { mustContain: "LEARNING_UPDATED" }),
      check("decision_log_linkage", "Learning record decisionLogId", [
        "src/lib/learning-queue/types.ts",
      ], { mustContain: "decisionLogId" }),
      check("single_source_of_truth", "Mission snapshot field", [
        "src/lib/mission-flow/types.ts",
      ], { mustContain: "learningProgress" }),
    ],
  },
  {
    mvpId: 76,
    name: "Integrated Trade Quality Score",
    tradeAffecting: false,
    missionSnapshotField: "integratedTradeQuality",
    testnetSnapshotField: "integratedTradeQuality",
    journalEventType: "TRADE_QUALITY_SCORED",
    checks: [
      check("route_or_api", "Trade quality API", [
        "src/app/api/integrated-trade-quality/route.ts",
      ]),
      check("data_source", "Score from closed journal", [
        "src/lib/trade-quality-score/sync-trade-quality-from-closed.ts",
      ]),
      check("write_path", "Quality store + journal event", [
        "src/lib/trade-quality-score/quality-store.ts",
        "src/lib/trade-quality-score/sync-trade-quality-from-closed.ts",
      ], { mustContain: "recordMonitorEvent" }),
      check("dashboard_visibility", "Trade quality badge", [
        "src/components/goal/GoalDashboard.tsx",
      ], { mustContain: "TradeQualityBadge" }),
      check("reports_visibility", "Reports trade quality", [
        "src/components/goal/ReportsView.tsx",
      ], { mustContain: "TradeQualityPanel" }),
      check("journal_event", "Scored event type", [
        "src/lib/testnet-monitor/types.ts",
      ], { mustContain: "TRADE_QUALITY_SCORED" }),
      check("decision_log_linkage", "Score uses decisionLogId", [
        "src/lib/trade-quality-score/score-testnet-closed-trade.ts",
      ], { mustContain: "decisionLogId" }),
      check("single_source_of_truth", "Snapshot on testnet build", [
        "src/lib/testnet-monitor/build-testnet-monitor-snapshot.ts",
      ], { mustContain: "integratedTradeQuality" }),
    ],
  },
  {
    mvpId: 74,
    name: "Integrated Strategy Health",
    tradeAffecting: true,
    missionSnapshotField: "integratedStrategyHealth",
    testnetSnapshotField: "integratedStrategyHealth",
    journalEventType: "STRATEGY_HEALTH_REVIEWED",
    checks: [
      check("route_or_api", "Strategy health API", [
        "src/app/api/integrated-strategy-health/route.ts",
      ]),
      check("data_source", "Build from evidence trades", [
        "src/lib/integrated-strategy-health/build-integrated-strategy-health.ts",
      ]),
      check("write_path", "Persist review + registry", [
        "src/lib/integrated-strategy-health/persist-strategy-health.ts",
      ]),
      check("dashboard_visibility", "Strategy health badge", [
        "src/components/goal/GoalDashboard.tsx",
      ], { mustContain: "StrategyHealthBadge" }),
      check("reports_visibility", "Reports strategy health", [
        "src/components/goal/ReportsView.tsx",
      ], { mustContain: "StrategyHealthReportPanel" }),
      check("journal_event", "Reviewed event", [
        "src/lib/testnet-monitor/types.ts",
      ], { mustContain: "STRATEGY_HEALTH_REVIEWED" }),
      check("risk_permission_check", "Blocks testnet entries", [
        "src/lib/integrated-strategy-health/build-strategy-health-report.ts",
      ], { mustContain: "blocksTestnetEntriesForHealth" }),
      check("decision_log_linkage", "Linked decision ids", [
        "src/lib/integrated-strategy-health/types.ts",
      ], { mustContain: "linkedDecisionIds" }),
      check("single_source_of_truth", "Mission flow wiring", [
        "src/lib/mission-flow/build-mission-flow-snapshot.ts",
      ], { mustContain: "integratedStrategyHealth" }),
    ],
  },
  {
    mvpId: 75,
    name: "Micro-Live Readiness",
    tradeAffecting: true,
    missionSnapshotField: "microLiveReadiness",
    testnetSnapshotField: "microLiveReadiness",
    journalEventType: "READINESS_CHECKED",
    checks: [
      check("route_or_api", "Readiness API", ["src/app/api/micro-live-readiness/route.ts"]),
      check("data_source", "Build readiness report", [
        "src/lib/micro-live-readiness/build-micro-live-readiness.ts",
      ]),
      check("write_path", "Persist readiness check", [
        "src/lib/micro-live-readiness/persist-readiness-check.ts",
      ]),
      check("dashboard_visibility", "Readiness badge", [
        "src/components/goal/GoalDashboard.tsx",
      ], { mustContain: "MicroLiveReadinessBadge" }),
      check("reports_visibility", "Reports checklist", [
        "src/components/goal/ReportsView.tsx",
      ], { mustContain: "MicroLiveReadinessChecklist" }),
      check("journal_event", "Readiness event", [
        "src/lib/testnet-monitor/types.ts",
      ], { mustContain: "READINESS_CHECKED" }),
      check("risk_permission_check", "Live locked in report", [
        "src/lib/micro-live-readiness/types.ts",
      ], { mustContain: "liveTradingLocked" }),
      check("single_source_of_truth", "Mission snapshot field", [
        "src/lib/mission-flow/types.ts",
      ], { mustContain: "microLiveReadiness" }),
    ],
  },
  {
    mvpId: 78,
    name: "Integrated Risk Budget Optimizer",
    tradeAffecting: true,
    missionSnapshotField: "integratedRiskBudget",
    testnetSnapshotField: "integratedRiskBudget",
    journalEventType: "RISK_BUDGET_RECOMMENDED",
    checks: [
      check("route_or_api", "Risk budget API", [
        "src/app/api/integrated-risk-budget/route.ts",
      ]),
      check("data_source", "Build from mission inputs", [
        "src/lib/integrated-risk-budget/build-risk-budget-recommendation.ts",
      ]),
      check("write_path", "Persist recommendation", [
        "src/lib/integrated-risk-budget/persist-risk-budget-event.ts",
      ]),
      check("dashboard_visibility", "Risk budget badge", [
        "src/components/goal/GoalDashboard.tsx",
      ], { mustContain: "RiskBudgetBadge" }),
      check("reports_visibility", "Reports risk budget", [
        "src/components/goal/ReportsView.tsx",
      ], { mustContain: "IntegratedRiskBudgetPanel" }),
      check("journal_event", "Budget recommended event", [
        "src/lib/testnet-monitor/types.ts",
      ], { mustContain: "RISK_BUDGET_RECOMMENDED" }),
      check("risk_permission_check", "Advisory in real-time risk", [
        "src/lib/real-time-risk/evaluate-realtime-risk.ts",
      ], { mustContain: "getCachedRiskBudgetRecommendation" }),
      check("single_source_of_truth", "Cannot auto-increase", [
        "src/lib/integrated-risk-budget/types.ts",
      ], { mustContain: "cannotIncreaseAutomatically" }),
    ],
  },
  {
    mvpId: 79,
    name: "Integrated Daily AI Self-Review",
    tradeAffecting: false,
    missionSnapshotField: "integratedDailySelfReview",
    testnetSnapshotField: "integratedDailySelfReview",
    journalEventType: "DAILY_SELF_REVIEW_CREATED",
    checks: [
      check("route_or_api", "Daily review API", [
        "src/app/api/integrated-daily-self-review/route.ts",
      ]),
      check("data_source", "Build from trades + decisions", [
        "src/lib/integrated-daily-self-review/build-daily-self-review.ts",
      ]),
      check("write_path", "Persist review event", [
        "src/lib/integrated-daily-self-review/persist-daily-self-review-event.ts",
      ]),
      check("dashboard_visibility", "Daily review badge", [
        "src/components/goal/GoalDashboard.tsx",
      ], { mustContain: "DailySelfReviewBadge" }),
      check("reports_visibility", "Reports daily review", [
        "src/components/goal/ReportsView.tsx",
      ], { mustContain: "IntegratedDailySelfReviewPanel" }),
      check("journal_event", "Review created event", [
        "src/lib/testnet-monitor/types.ts",
      ], { mustContain: "DAILY_SELF_REVIEW_CREATED" }),
      check("decision_log_linkage", "Linked learning records", [
        "src/lib/integrated-daily-self-review/types.ts",
      ], { mustContain: "linkedLearningRecordIds" }),
      check("single_source_of_truth", "Mission snapshot wiring", [
        "src/lib/mission-flow/build-mission-flow-snapshot.ts",
      ], { mustContain: "integratedDailySelfReview" }),
    ],
  },
  {
    mvpId: 83,
    name: "Central Analysis Engine",
    tradeAffecting: true,
    journalEventType: "VERDICT_CREATED",
    checks: [
      check("route_or_api", "Analysis API routes", [
        "src/app/api/analysis/state/route.ts",
        "src/app/api/analysis/run/route.ts",
        "src/app/api/analysis/latest/route.ts",
        "src/app/api/analysis/events/route.ts",
      ]),
      check("data_source", "Central orchestrator", [
        "src/lib/analysis-engine/analysis-orchestrator.ts",
      ]),
      check("write_path", "Persist analysis state", [
        "src/lib/analysis-engine/analysis-engine-storage.ts",
      ]),
      check("journal_event", "Engine verdict event", [
        "src/lib/engine-event-bus/types.ts",
      ], { mustContain: "VERDICT_CREATED" }),
      check("decision_log_linkage", "Result decisionLogId", [
        "src/lib/analysis-engine/analysis-result.ts",
      ], { mustContain: "decisionLogId" }),
      check("risk_permission_check", "No auto execute", [
        "src/lib/analysis-engine/analysis-orchestrator.ts",
      ], { mustContain: "autoExecuteBlocked: true" }),
      check("single_source_of_truth", "Start AI delegates to engine", [
        "src/lib/goal-engine/run-start-ai-cycle.ts",
      ], { mustContain: "runCentralAnalysisOrchestrator" }),
    ],
  },
  {
    mvpId: 85,
    name: "Engine Event Bus & UI Sync",
    tradeAffecting: false,
    journalEventType: "VERDICT_CREATED",
    checks: [
      check("route_or_api", "Engine events API", [
        "src/app/api/analysis/events/route.ts",
        "src/app/api/analysis/events/stream/route.ts",
      ]),
      check("write_path", "Engine event journal", [
        "src/lib/engine-event-bus/engine-event-store.ts",
      ]),
      check("data_source", "Emit engine events", [
        "src/lib/engine-event-bus/emit-engine-event.ts",
      ]),
      check("dashboard_visibility", "Dashboard event alert", [
        "src/components/goal/GoalDashboard.tsx",
      ], { mustContain: "EngineEventAlertBanner" }),
      check("reports_visibility", "Reports event timeline", [
        "src/components/goal/ReportsView.tsx",
      ], { mustContain: "Event timeline" }),
      check("journal_event", "Event types defined", [
        "src/lib/engine-event-bus/types.ts",
      ], { mustContain: "ANALYSIS_STARTED" }),
      check("decision_log_linkage", "Traceable decisionLogId", [
        "src/lib/engine-event-bus/types.ts",
      ], { mustContain: "decisionLogId" }),
    ],
  },
  {
    mvpId: 86,
    name: "Advanced Module Consolidation",
    tradeAffecting: false,
    journalEventType: "CONTEXT_BUILT",
    checks: [
      check("route_or_api", "Advanced modules API", [
        "src/app/api/advanced/modules/route.ts",
        "src/app/api/advanced/modules/[moduleId]/route.ts",
      ]),
      check("data_source", "Module registry", [
        "src/lib/advanced-modules/registry.ts",
      ], { mustContain: "strategy-registry" }),
      check("single_source_of_truth", "AnalysisContext advancedModules", [
        "src/lib/analysis-engine/analysis-state.ts",
      ], { mustContain: "advancedModules" }),
      check("write_path", "Attach modules to context", [
        "src/lib/advanced-modules/attach-to-context.ts",
      ]),
      check("dashboard_visibility", "Advanced index engine cards", [
        "src/components/goal/AdvancedView.tsx",
      ], { mustContain: "Used by Central Engine" }),
      check("journal_event", "Module layout banner", [
        "src/components/advanced/AdvancedModuleEngineBanner.tsx",
      ], { mustContain: "Impact on latest analysis" }),
      check("decision_log_linkage", "Strategies wrapped in layout", [
        "src/app/strategies/page.tsx",
      ], { mustContain: "AdvancedModuleLayout" }),
    ],
  },
  {
    mvpId: 87,
    name: "Analysis Engine Health Dashboard",
    tradeAffecting: false,
    journalEventType: "READINESS_CHECKED",
    checks: [
      check("route_or_api", "Engine health API", [
        "src/app/api/analysis/health/route.ts",
      ]),
      check("data_source", "Health snapshot builder", [
        "src/lib/analysis-engine-health/build-engine-health.ts",
      ], { mustContain: "market_data_fresh" }),
      check("dashboard_visibility", "Engine health page", [
        "src/components/advanced/EngineHealthDashboard.tsx",
      ], { mustContain: "Dashboard summary" }),
      check("reports_visibility", "Advanced engine health link", [
        "src/components/goal/AdvancedView.tsx",
      ], { mustContain: "Engine Health" }),
      check("journal_event", "Readiness check id", [
        "src/lib/engine-event-bus/types.ts",
      ], { mustContain: "READINESS_CHECKED" }),
      check("single_source_of_truth", "Duplicate source check", [
        "src/lib/analysis-engine-health/build-engine-health.ts",
      ], { mustContain: "no_duplicate_source_of_truth" }),
    ],
  },
  {
    mvpId: 88,
    name: "Engine Consistency & Reconciliation",
    tradeAffecting: true,
    journalEventType: "READINESS_CHECKED",
    checks: [
      check("route_or_api", "Consistency API", [
        "src/app/api/analysis/consistency/route.ts",
        "src/app/api/analysis/consistency/fix/route.ts",
      ]),
      check("data_source", "Consistency builder", [
        "src/lib/engine-consistency/build-engine-consistency.ts",
      ], { mustContain: "trade_without_decision_log_id" }),
      check("write_path", "Safe auto-fix", [
        "src/lib/engine-consistency/apply-consistency-auto-fix.ts",
      ], { mustContain: "tradesOpened: false" }),
      check("dashboard_visibility", "Dashboard engine banner", [
        "src/components/goal/GoalDashboard.tsx",
      ], { mustContain: "EngineStatusBanner" }),
      check("reports_visibility", "Reconciliation page", [
        "src/components/advanced/ReconciliationDashboard.tsx",
      ], { mustContain: "Consistency status" }),
      check("risk_permission_check", "Blocks uncertain positions", [
        "src/lib/exchange/binance/unified-testnet-trade-gate.ts",
      ], { mustContain: "consistencyBlocksNewTrades" }),
      check("decision_log_linkage", "Decision drift check", [
        "src/lib/engine-consistency/build-engine-consistency.ts",
      ], { mustContain: "decision_without_journal_event" }),
    ],
  },
  {
    mvpId: 89,
    name: "Evidence Quality Layer",
    tradeAffecting: true,
    missionSnapshotField: "evidenceQuality",
    testnetSnapshotField: "evidenceQuality",
    journalEventType: "EVIDENCE_QUALITY_CHECKED",
    checks: [
      check("route_or_api", "Evidence quality API", [
        "src/app/api/analysis/evidence-quality/route.ts",
      ]),
      check("data_source", "Evidence quality builder", [
        "src/lib/evidence-quality/build-evidence-quality.ts",
      ], { mustContain: "tradeQualityScore" }),
      check("write_path", "Strategy health gate", [
        "src/lib/integrated-strategy-health/build-integrated-strategy-health.ts",
      ], { mustContain: "evidenceQualityBlocked" }),
      check("dashboard_visibility", "Reports evidence panel", [
        "src/components/goal/ReportsView.tsx",
      ], { mustContain: "EvidenceQualityPanel" }),
      check("reports_visibility", "Evidence quality detail", [
        "src/components/advanced/EvidenceQualityDashboard.tsx",
      ], { mustContain: "Evidence quality status" }),
      check("risk_permission_check", "Blocks poor evidence review", [
        "src/lib/integrated-strategy-health/build-integrated-strategy-health.ts",
      ], { mustContain: "blocksStrategyHealthReview" }),
      check("decision_log_linkage", "DecisionLogId required", [
        "src/lib/evidence-quality/build-evidence-quality.ts",
      ], { mustContain: "decisionLogId" }),
      check("single_source_of_truth", "Mission snapshot field", [
        "src/lib/mission-flow/types.ts",
      ], { mustContain: "evidenceQuality" }),
    ],
  },
  {
    mvpId: 90,
    name: "Integrated Trade Quality & Confidence Calibration",
    tradeAffecting: false,
    missionSnapshotField: "integratedQualityCalibration",
    testnetSnapshotField: "integratedQualityCalibration",
    journalEventType: "CONFIDENCE_CALIBRATED",
    checks: [
      check("route_or_api", "Quality calibration API", [
        "src/app/api/integrated-quality-calibration/route.ts",
      ]),
      check("data_source", "MVP 90 builder", [
        "src/lib/integrated-quality-calibration/build-integrated-quality-calibration.ts",
      ], { mustContain: "overconfidenceWarning" }),
      check("write_path", "Eight-dimension trade quality", [
        "src/lib/trade-quality-score/config.ts",
      ], { mustContain: "marketRegimeFit" }),
      check("dashboard_visibility", "Reports quality section", [
        "src/components/goal/ReportsView.tsx",
      ], { mustContain: "IntegratedQualityCalibrationPanel" }),
      check("reports_visibility", "Quality calibration panel", [
        "src/components/integrated-quality-calibration/IntegratedQualityCalibrationPanel.tsx",
      ], { mustContain: "strategyImprovementSuggestion" }),
      check("journal_event", "Calibration event type", [
        "src/lib/testnet-monitor/types.ts",
      ], { mustContain: "CONFIDENCE_CALIBRATED" }),
      check("decision_log_linkage", "Regime fit from decision", [
        "src/lib/trade-quality-score/score-market-regime-fit.ts",
      ], { mustContain: "marketRegime" }),
      check("single_source_of_truth", "Mission snapshot field", [
        "src/lib/mission-flow/types.ts",
      ], { mustContain: "integratedQualityCalibration" }),
      check("risk_permission_check", "Risk budget overconfidence", [
        "src/lib/integrated-risk-budget/build-risk-budget-recommendation.ts",
      ], { mustContain: "overconfidenceWarning" }),
    ],
  },
  {
    mvpId: 91,
    name: "Strategy Health & Agent Scoreboard v2",
    tradeAffecting: true,
    missionSnapshotField: "integratedStrategyAgentHealth",
    testnetSnapshotField: "integratedStrategyAgentHealth",
    journalEventType: "AGENT_SCOREBOARD_REVIEWED",
    checks: [
      check("route_or_api", "Strategy agent health API", [
        "src/app/api/integrated-strategy-agent-health/route.ts",
      ]),
      check("data_source", "Enriched agent scoreboard", [
        "src/lib/integrated-strategy-agent-health/build-agent-scoreboard-v2-enriched.ts",
      ], { mustContain: "falsePositiveRate" }),
      check("write_path", "Integrated strategy agent health", [
        "src/lib/integrated-strategy-agent-health/build-integrated-strategy-agent-health.ts",
      ], { mustContain: "humanApprovalRequired" }),
      check("dashboard_visibility", "Reports agent scoreboard", [
        "src/components/goal/ReportsView.tsx",
      ], { mustContain: "AgentScoreboardV2Panel" }),
      check("reports_visibility", "Agent scoreboard panel", [
        "src/components/integrated-strategy-agent-health/AgentScoreboardV2Panel.tsx",
      ], { mustContain: "predictionAccuracyPct" }),
      check("journal_event", "Agent scoreboard event", [
        "src/lib/testnet-monitor/types.ts",
      ], { mustContain: "AGENT_SCOREBOARD_REVIEWED" }),
      check("decision_log_linkage", "Agent votes from decision log", [
        "src/lib/integrated-strategy-agent-health/build-agent-scoreboard-v2-enriched.ts",
      ], { mustContain: "agentOutputs" }),
      check("single_source_of_truth", "Mission snapshot field", [
        "src/lib/mission-flow/types.ts",
      ], { mustContain: "integratedStrategyAgentHealth" }),
      check("risk_permission_check", "No auto strategy change", [
        "src/lib/integrated-strategy-agent-health/types.ts",
      ], { mustContain: "autoStrategyChangeAllowed: false" }),
    ],
  },
  {
    mvpId: 92,
    name: "Mission Controller & Risk Budget",
    tradeAffecting: true,
    missionSnapshotField: "missionControllerRiskBudget",
    testnetSnapshotField: "missionControllerRiskBudget",
    journalEventType: "MISSION_CONTROLLER_EVALUATED",
    checks: [
      check("route_or_api", "Mission controller API", [
        "src/app/api/mission-controller-risk-budget/route.ts",
      ]),
      check("data_source", "Unified mission mode resolver", [
        "src/lib/mission-controller-risk-budget/resolve-mission-mode.ts",
      ], { mustContain: "dailyLossLimitHit" }),
      check("write_path", "Build mission controller snapshot", [
        "src/lib/mission-controller-risk-budget/build-mission-controller-risk-budget.ts",
      ], { mustContain: "recommendedMaxNotional" }),
      check("dashboard_visibility", "Mission controller badge", [
        "src/components/goal/GoalDashboard.tsx",
      ], { mustContain: "MissionControllerRiskBudgetBadge" }),
      check("reports_visibility", "Reports mission controller", [
        "src/components/goal/ReportsView.tsx",
      ], { mustContain: "MissionControllerRiskBudgetPanel" }),
      check("journal_event", "Mission evaluated event", [
        "src/lib/testnet-monitor/types.ts",
      ], { mustContain: "MISSION_CONTROLLER_EVALUATED" }),
      check("risk_permission_check", "Cannot auto-increase live risk", [
        "src/lib/mission-controller-risk-budget/types.ts",
      ], { mustContain: "cannotIncreaseLiveRiskAutomatically" }),
      check("single_source_of_truth", "Mission snapshot field", [
        "src/lib/mission-flow/types.ts",
      ], { mustContain: "missionControllerRiskBudget" }),
      check("risk_permission_check", "PAUSED blocks testnet entries", [
        "src/lib/exchange/binance/unified-testnet-trade-gate.ts",
      ], { mustContain: 'missionMode === "PAUSED"' }),
    ],
  },
  {
    mvpId: 93,
    name: "Always-on Operator Layer",
    tradeAffecting: true,
    missionSnapshotField: "alwaysOnOperatorLayer",
    testnetSnapshotField: "alwaysOnOperatorLayer",
    journalEventType: "OPERATOR_LAYER_TICK",
    checks: [
      check("route_or_api", "Operator layer API", [
        "src/app/api/always-on-operator-layer/route.ts",
      ]),
      check("data_source", "Operator layer tick", [
        "src/lib/always-on-operator-layer/run-operator-layer-tick.ts",
      ], { mustContain: "refresh_positions" }),
      check("write_path", "Operator heartbeat store", [
        "src/lib/always-on-operator-layer/operator-heartbeat-store.ts",
      ]),
      check("dashboard_visibility", "Operator badge", [
        "src/components/goal/GoalDashboard.tsx",
      ], { mustContain: "AlwaysOnOperatorLayerBadge" }),
      check("reports_visibility", "Reports operator panel", [
        "src/components/goal/ReportsView.tsx",
      ], { mustContain: "AlwaysOnOperatorLayerPanel" }),
      check("journal_event", "Operator tick event", [
        "src/lib/testnet-monitor/types.ts",
      ], { mustContain: "OPERATOR_LAYER_TICK" }),
      check("risk_permission_check", "Cannot open orders", [
        "src/lib/always-on-operator-layer/types.ts",
      ], { mustContain: "cannotOpenOrders" }),
      check("single_source_of_truth", "Mission snapshot field", [
        "src/lib/mission-flow/types.ts",
      ], { mustContain: "alwaysOnOperatorLayer" }),
      check("risk_permission_check", "Telegram commands safety", [
        "src/lib/telegram-control-channel/commands.ts",
      ], { mustContain: "doubleConfirm: true" }),
    ],
  },
  {
    mvpId: 94,
    name: "Micro-live Readiness Review",
    tradeAffecting: false,
    missionSnapshotField: "microLiveReadinessReview",
    testnetSnapshotField: "microLiveReadinessReview",
    journalEventType: "READINESS_REVIEWED",
    checks: [
      check("route_or_api", "Readiness review API", [
        "src/app/api/micro-live-readiness-review/route.ts",
      ]),
      check("data_source", "13-item readiness checklist", [
        "src/lib/micro-live-readiness-review/build-readiness-review-checklist.ts",
      ], { mustContain: "engine_consistency_ok" }),
      check("write_path", "Persist readiness review", [
        "src/lib/micro-live-readiness-review/persist-readiness-review.ts",
      ], { mustContain: "READINESS_REVIEWED" }),
      check("dashboard_visibility", "Readiness review badge", [
        "src/components/goal/GoalDashboard.tsx",
      ], { mustContain: "MicroLiveReadinessReviewBadge" }),
      check("reports_visibility", "Reports readiness review", [
        "src/components/goal/ReportsView.tsx",
      ], { mustContain: "MicroLiveReadinessReviewPanel" }),
      check("journal_event", "Readiness reviewed event", [
        "src/lib/testnet-monitor/types.ts",
      ], { mustContain: "READINESS_REVIEWED" }),
      check("risk_permission_check", "Cannot enable live", [
        "src/lib/micro-live-readiness-review/types.ts",
      ], { mustContain: "cannotEnableLive" }),
      check("single_source_of_truth", "Mission snapshot field", [
        "src/lib/mission-flow/types.ts",
      ], { mustContain: "microLiveReadinessReview" }),
      check("risk_permission_check", "Cannot place live orders", [
        "src/lib/micro-live-readiness-review/types.ts",
      ], { mustContain: "cannotPlaceLiveOrders" }),
    ],
  },
];
