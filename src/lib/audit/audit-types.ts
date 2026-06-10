export interface AuditPackSection {
  name: string;
  itemCount: number;
  summary: string;
}

export interface AuditPack {
  auditId: string;
  generatedAt: string;
  sections: AuditPackSection[];
  recommendation: "READY_FOR_CONTROLLED_MICRO_LIVE" | "NOT_READY";
  liveLocked: true;
  redacted: true;
}

export interface SecurityCheckResult {
  checkedAt: string;
  passed: boolean;
  issues: Array<{ code: string; message: string }>;
  secretsRedacted: true;
}

export interface ProductionHealthResult {
  checkedAt: string;
  status: "OK" | "WARNING" | "CRITICAL";
  issues: Array<{ code: string; message: string }>;
  recommendation: "READY_FOR_CONTROLLED_MICRO_LIVE" | "NOT_READY";
}
