import type { CapitalMissionStage } from "./capital-types";

/** $1k → $20k mission ladder (planning only — no fund movement). */
export const MISSION_STAGE_FLOORS_USD = [
  1_000, 2_000, 4_000, 8_000, 16_000, 20_000,
] as const;

export const MISSION_GOAL_USD = 20_000;
export const MISSION_DEFAULT_START_USD = 1_000;

export function buildMissionStages(): CapitalMissionStage[] {
  const floors = [...MISSION_STAGE_FLOORS_USD];
  return floors.map((floor, i) => {
    const next = floors[i + 1] ?? null;
    const isLast = i === floors.length - 1;
    return {
      id: `stage-${floor}`,
      label: isLast
        ? `$${(floor / 1000).toFixed(0)}k+`
        : `$${(floor / 1000).toFixed(0)}k → $${next ? (next / 1000).toFixed(0) : "20"}k`,
      floorUsd: floor,
      ceilingUsd: isLast ? null : next,
      nextFloorUsd: next,
    };
  });
}
