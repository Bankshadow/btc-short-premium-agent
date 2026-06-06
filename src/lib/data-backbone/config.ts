export const BACKBONE_STORAGE_KEY = "btc-desk:data-backbone-record";
export const BACKBONE_CLIENT_ID_KEY = "btc-desk:data-backbone-client-id";

/** Data older than this is flagged stale (minutes). */
export const BACKBONE_STALE_MINUTES = 60;

export const BACKBONE_REQUIRED_FIELDS = [
  "portfolio.sampleSize",
  "learning.strategySampleSize",
  "learning.resolvedOutcomesCount",
] as const;
