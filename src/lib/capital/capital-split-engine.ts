import type { CapitalAllocationRecommendation } from "@/lib/validation/validation-types";
import type {
  CapitalSplitBucket,
  CapitalSplitRecommendation,
  CapitalStageSnapshot,
} from "./capital-types";

/** Stage-index split templates when equity doubles along the mission ladder. */
const STAGE_SPLIT_TEMPLATES: Array<{
  reserve: number;
  core: number;
  growth: number;
  experimental: number;
  note: string;
}> = [
  {
    reserve: 50,
    core: 35,
    growth: 10,
    experimental: 5,
    note: "Foundation stage — protect capital while proving edge on paper.",
  },
  {
    reserve: 40,
    core: 40,
    growth: 15,
    experimental: 5,
    note: "First double — shift modestly into growth sleeve.",
  },
  {
    reserve: 35,
    core: 40,
    growth: 20,
    experimental: 5,
    note: "Mid-ladder — core strategies carry book; growth sleeve expands.",
  },
  {
    reserve: 30,
    core: 45,
    growth: 20,
    experimental: 5,
    note: "Upper mid — reserve drops as track record deepens.",
  },
  {
    reserve: 25,
    core: 45,
    growth: 25,
    experimental: 5,
    note: "Pre-goal — growth allocation rises; experimental capped.",
  },
  {
    reserve: 20,
    core: 40,
    growth: 30,
    experimental: 10,
    note: "Mission goal band — balanced book with controlled experiment sleeve.",
  },
];

function blendPct(stagePct: number, validationPct: number, weight = 0.55): number {
  return Math.round(stagePct * weight + validationPct * (1 - weight));
}

function normalizeBuckets(
  reserve: number,
  core: number,
  growth: number,
  experimental: number,
  equityUsd: number,
): CapitalSplitBucket[] {
  const total = reserve + core + growth + experimental;
  const scale = total > 100 ? 100 / total : 1;
  const r = Math.round(reserve * scale);
  const c = Math.round(core * scale);
  const g = Math.round(growth * scale);
  const e = Math.max(0, 100 - r - c - g);

  const defs: Array<{
    key: CapitalSplitBucket["key"];
    label: string;
    pct: number;
    note: string;
  }> = [
    {
      key: "protected_reserve",
      label: "Protected Reserve",
      pct: r,
      note: "Cash buffer — not deployed to strategies (simulation).",
    },
    {
      key: "core_strategy",
      label: "Core Strategy Capital",
      pct: c,
      note: "Validated ACTIVE strategies from MVP 10 matrix.",
    },
    {
      key: "growth_strategy",
      label: "Growth Strategy Capital",
      pct: g,
      note: "WATCHLIST / regime-aligned sleeves with positive avg R.",
    },
    {
      key: "experimental",
      label: "Experimental Capital",
      pct: e,
      note: "Paper-only / experimental — hard cap from validation rules.",
    },
  ];

  return defs.map((d) => ({
    key: d.key,
    label: d.label,
    pct: d.pct,
    amountUsd: Math.round((equityUsd * d.pct) / 100),
    note: d.note,
  }));
}

export function buildCapitalSplitRecommendation(input: {
  stage: CapitalStageSnapshot;
  validationAllocation: CapitalAllocationRecommendation;
}): CapitalSplitRecommendation {
  const { stage, validationAllocation: v } = input;
  const tpl =
    STAGE_SPLIT_TEMPLATES[
      Math.min(stage.stageIndex, STAGE_SPLIT_TEMPLATES.length - 1)
    ];

  let reserve = blendPct(tpl.reserve, v.reservePct);
  let core = blendPct(tpl.core, v.coreStrategyPct);
  let growth = blendPct(tpl.growth, v.growthStrategyPct);
  let experimental = blendPct(tpl.experimental, v.experimentalPct);

  if (v.reservePct >= 85) {
    reserve = 85;
    core = 10;
    growth = 5;
    experimental = 0;
  }

  const buckets = normalizeBuckets(
    reserve,
    core,
    growth,
    experimental,
    stage.equityUsd,
  );

  const trigger = stage.doubledSinceLastStage
    ? `Equity at or above 2× stage floor ($${stage.stageEntryUsd.toLocaleString()}) — rebalance recommended.`
    : `Within ${stage.current.label} — hold split until next double or milestone.`;

  return {
    buckets,
    totalPct: buckets.reduce((s, b) => s + b.pct, 0),
    trigger,
    summary: `${tpl.note} Blended with MVP 10 validation allocation (kill switch / regime aware).`,
    validationAllocation: v,
  };
}
