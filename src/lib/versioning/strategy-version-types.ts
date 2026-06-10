export interface StrategyVersion {
  versionId: string;
  versionNumber: number;
  label: string;
  changelog: string[];
  createdAt: string;
  createdBy: string;
  active: boolean;
  rollbackOf: string | null;
}

export interface StrategyVersionSnapshot {
  versions: StrategyVersion[];
  activeVersion: StrategyVersion | null;
  liveLocked: true;
}
