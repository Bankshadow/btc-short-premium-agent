import { buildSkillCardFromSource } from "@/lib/project-strategist/skill-research/extract-skill-card";
import type { StrategistExternalSource } from "@/lib/project-strategist/types";
import type { SkillResearchResult } from "./types";

export function runSkillResearchAgent(input: {
  sources: StrategistExternalSource[];
}): SkillResearchResult {
  const skillUpdates = input.sources
    .map((source) => buildSkillCardFromSource(source))
    .filter((card): card is NonNullable<typeof card> => card != null);

  const sourceInsights = input.sources.map((source) => {
    const status = source.fetchStatus;
    if (status === "FETCH_FAILED") {
      return `Source ${source.title}: fetch failed, manual paste recommended.`;
    }
    if (status === "PASTED") {
      return `Source ${source.title}: manually pasted content analyzed.`;
    }
    return `Source ${source.title}: analyzed for reusable workflow patterns.`;
  });

  return { skillUpdates, sourceInsights };
}
