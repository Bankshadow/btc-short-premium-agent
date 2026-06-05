export const OPTIONS_RISK_THRESHOLDS = {
  maxNetDelta: Number(process.env.OPTIONS_MAX_NET_DELTA ?? 0.45),
  maxNetGamma: Number(process.env.OPTIONS_MAX_NET_GAMMA ?? 0.008),
  maxNetVega: Number(process.env.OPTIONS_MAX_NET_VEGA ?? 500),
  maxMarginUsagePct: Number(process.env.OPTIONS_MAX_MARGIN_USAGE_PCT ?? 40),
  maxExpiryConcentrationPct: Number(process.env.OPTIONS_MAX_EXPIRY_CONC_PCT ?? 60),
  shortCallDangerSpotPct: Number(process.env.OPTIONS_SHORT_CALL_DANGER_PCT ?? 3),
  spotNearStrikePct: Number(process.env.OPTIONS_NEAR_STRIKE_PCT ?? 2),
  marginHaircut: 1.2,
} as const;
