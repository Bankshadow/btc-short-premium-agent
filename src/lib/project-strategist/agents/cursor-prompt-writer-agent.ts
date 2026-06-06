import type { MVPProposal } from "@/lib/project-strategist/types";
import type { AuditDiagnosis } from "./types";

export function runCursorPromptWriterAgent(input: {
  mvp: MVPProposal;
  diagnosis: AuditDiagnosis;
}): string {
  return [
    "You are working on btc-short-premium-agent.",
    "",
    `Implement MVP: ${input.mvp.title}.`,
    "",
    "Objective:",
    input.mvp.problem,
    "",
    "Constraints:",
    "- Do not execute trades.",
    "- Do not change live trading settings.",
    "- Do not auto-merge code.",
    "- Preserve governance and risk gates.",
    "",
    "Required scope:",
    ...input.mvp.oneDayPlan.map((step, idx) => `${idx + 1}. ${step}`),
    "",
    "Acceptance criteria:",
    ...input.mvp.acceptanceCriteria.map((rule) => `- ${rule}`),
    "",
    "Current diagnosis context:",
    `- Product: ${input.diagnosis.productDiagnosis}`,
    `- Technical: ${input.diagnosis.technicalDiagnosis}`,
    `- Trading readiness: ${input.diagnosis.tradingReadinessDiagnosis}`,
    `- UX: ${input.diagnosis.uxDiagnosis}`,
    `- Automation: ${input.diagnosis.automationDiagnosis}`,
    "",
    "Deliverables:",
    "- Code changes with tests where relevant.",
    "- Short implementation summary.",
    "- Follow-up checklist for operator validation.",
  ].join("\n");
}
