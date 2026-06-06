import type { SkillCard } from "@/lib/project-strategist/types";

export interface SkillLibrarySnapshot {
  active: SkillCard[];
  proposed: SkillCard[];
  rejected: SkillCard[];
}

export function buildSkillLibrarySnapshot(skills: SkillCard[]): SkillLibrarySnapshot {
  return {
    active: skills.filter((s) => s.status === "ACTIVE"),
    proposed: skills.filter((s) => s.status === "PROPOSED"),
    rejected: skills.filter((s) => s.status === "REJECTED"),
  };
}

export function rollbackSkillStatus(
  skills: SkillCard[],
  skillId: string,
): SkillCard[] {
  return skills.map((skill) => {
    if (skill.skillId !== skillId) return skill;
    const history = skill.statusHistory ?? [];
    const last = history[history.length - 1];
    if (!last) return skill;
    return {
      ...skill,
      status: last.from,
      updatedAt: new Date().toISOString(),
      statusHistory: history.slice(0, -1),
    };
  });
}
