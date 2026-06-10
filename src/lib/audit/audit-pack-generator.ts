import { appendEvent, getEvents } from "@/lib/journal/journal-query";
import { newAuditPackId } from "@/lib/journal/journal-types";
import { getEvidenceProgressView } from "@/lib/evidence/evidence-progress";
import { buildMissionSnapshot } from "@/lib/mission/mission-snapshot";
import { getAllImprovementProposals } from "@/lib/improvement/proposal-generator";
import { buildMicroLiveReadinessView } from "@/lib/live-readiness/readiness-evaluator";
import { getLiveSandboxStatus } from "@/lib/live-sandbox/live-dry-run";
import { getAllPnlRecords } from "@/lib/pnl/pnl-store";
import { getAllLearningRecords } from "@/lib/learning/learning-store";
import { getStrategyVersionSnapshot } from "@/lib/versioning/strategy-version-store";
import { redactSecrets } from "@/lib/security/security-check";
import type { AuditPack } from "./audit-types";

export async function generateAuditPack(): Promise<AuditPack> {
  const events = await getEvents();
  const mission = buildMissionSnapshot(events);
  const evidence = await getEvidenceProgressView();
  const pnl = await getAllPnlRecords();
  const learning = await getAllLearningRecords();
  const versions = await getStrategyVersionSnapshot();
  const improvements = await getAllImprovementProposals();
  const readiness = await buildMicroLiveReadinessView();
  const sandbox = await getLiveSandboxStatus();

  const operatorActions = events.filter((e) => e.type === "OPERATOR_ACTION_RECORDED").length;
  const riskEvents = events.filter((e) =>
    ["PORTFOLIO_RISK_EVALUATED", "NO_TRADE_RULE_TRIGGERED", "TRADE_BLOCKED_BY_RULE"].includes(e.type),
  ).length;
  const incidents = events.filter(
    (e) => e.type === "ERROR_RECORDED" || e.type === "STATE_HEALTH_BLOCKED",
  ).length;
  const lifecycleTrades = events.filter((e) => e.type === "POSITION_CLOSED").length;

  const sections = [
    { name: "mission", itemCount: 1, summary: `Equity $${mission.currentEquity}` },
    { name: "evidence_trades", itemCount: evidence.valid, summary: `${evidence.valid}/12 valid` },
    { name: "trade_lifecycle", itemCount: lifecycleTrades, summary: `${lifecycleTrades} closed` },
    { name: "pnl_records", itemCount: pnl.length, summary: `${pnl.length} PNL_REALIZED` },
    { name: "learning_records", itemCount: learning.length, summary: `${learning.length} records` },
    { name: "strategy_versions", itemCount: versions.versions.length, summary: versions.activeVersion?.label ?? "baseline" },
    { name: "rule_changes", itemCount: improvements.length, summary: `${improvements.filter((p) => p.status === "APPROVED").length} approved` },
    { name: "operator_actions", itemCount: operatorActions, summary: `${operatorActions} actions` },
    { name: "risk_events", itemCount: riskEvents, summary: `${riskEvents} events` },
    { name: "incidents", itemCount: incidents, summary: `${incidents} incidents` },
    { name: "readiness", itemCount: readiness.criteria.filter((c) => c.met).length, summary: readiness.recommendation },
    { name: "live_sandbox", itemCount: 1, summary: sandbox.message },
  ];

  const pack: AuditPack = {
    auditId: newAuditPackId(),
    generatedAt: new Date().toISOString(),
    sections,
    recommendation: readiness.recommendation,
    liveLocked: true,
    redacted: true,
  };

  await appendEvent({
    type: "AUDIT_PACK_CREATED",
    environment: "testnet",
    payload: redactSecrets(pack) as Record<string, unknown>,
  });

  return pack;
}

export async function getLatestAuditPack(): Promise<AuditPack | null> {
  const events = await getEvents();
  const evt = [...events]
    .filter((e) => e.type === "AUDIT_PACK_CREATED")
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
  if (!evt) return null;
  return evt.payload as unknown as AuditPack;
}
