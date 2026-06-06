export function newStrategistReportId(): string {
  return `psr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function newStrategistSourceId(): string {
  return `pss-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function newStrategistSkillId(): string {
  return `psk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function newStrategistMvpId(): string {
  return `psm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
