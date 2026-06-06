import type { SkillCard, SkillType, StrategistExternalSource } from "@/lib/project-strategist/types";

function classifySkillType(text: string): SkillType {
  const t = text.toLowerCase();
  if (t.includes("prompt") || t.includes("cursor")) return "CURSOR_PROMPTING";
  if (t.includes("workflow") || t.includes("automation")) return "AI_WORKFLOW";
  if (t.includes("ux") || t.includes("ui") || t.includes("navigation")) {
    return "UX_REFACTOR";
  }
  if (t.includes("risk") || t.includes("governance")) return "RISK_CONTROL";
  if (t.includes("testnet") || t.includes("exchange")) return "TESTNET_EXECUTION";
  if (t.includes("architecture") || t.includes("platform")) {
    return "PLATFORM_ARCHITECTURE";
  }
  if (t.includes("trading")) return "TRADING_SYSTEM";
  return "PRODUCT_STRATEGY";
}

function inferDecision(text: string): "ADOPT" | "IGNORE" | "REVIEW" {
  const t = text.toLowerCase();
  if (t.includes("not relevant") || t.includes("ignore")) return "IGNORE";
  if (t.includes("high risk") || t.includes("unverified")) return "REVIEW";
  return "ADOPT";
}

export function buildSkillCardFromSource(
  source: StrategistExternalSource,
): SkillCard | null {
  const content = source.sourceContent?.trim();
  if (!content) return null;

  const summary = content.slice(0, 320);
  const principle = content
    .split(".")
    .map((s) => s.trim())
    .filter(Boolean)[0] ?? "Focus on one measurable improvement loop per day.";
  const workflow = [
    "Capture problem statement with one measurable KPI.",
    "Design one-day implementation slice with acceptance criteria.",
    "Run in paper/testnet-first mode before wider rollout.",
  ];
  const skillType = classifySkillType(content);
  const now = new Date().toISOString();
  return {
    skillId: `psk-${source.sourceId}`,
    sourceUrl: source.sourceUrl,
    title: source.title,
    summary,
    extractedPrinciple: principle,
    applicableToProject:
      "Applies to daily prioritization, UX simplification, and safer execution loops.",
    proposedWorkflow: workflow,
    risk:
      "External source may be context-specific; requires operator approval before ACTIVE.",
    confidence: source.fetchStatus === "FETCHED" ? 0.74 : 0.62,
    status: "PROPOSED",
    skillType,
    proposedAction: inferDecision(content),
    sourceContent: content,
    createdAt: now,
    updatedAt: now,
    statusHistory: [],
  };
}
