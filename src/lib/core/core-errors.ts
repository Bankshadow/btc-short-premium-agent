export class CoreValidationError extends Error {
  readonly code: string;
  readonly issues: CoreValidationIssue[];

  constructor(code: string, message: string, issues: CoreValidationIssue[] = []) {
    super(message);
    this.name = "CoreValidationError";
    this.code = code;
    this.issues = issues;
  }
}

export type EventValidationSeverity = "WARNING" | "ERROR" | "CRITICAL";

export interface EventValidationIssue {
  code: string;
  severity: EventValidationSeverity;
  message: string;
  field?: string;
  requiredAction?: string;
}

export interface EventValidationResult {
  valid: boolean;
  errors: EventValidationIssue[];
  warnings: EventValidationIssue[];
}

/** @deprecated Use EventValidationIssue — kept for lifecycle/batch validators. */
export interface CoreValidationIssue {
  code: string;
  message: string;
  severity: "ERROR" | "WARNING";
  field?: string;
  tradeId?: string;
}

export function toCoreValidationIssues(issues: EventValidationIssue[]): CoreValidationIssue[] {
  return issues.map((i) => ({
    code: i.code,
    message: i.message,
    severity: i.severity === "WARNING" ? "WARNING" : "ERROR",
    field: i.field,
  }));
}

export function isBlockingIssue(issue: EventValidationIssue): boolean {
  return issue.severity === "ERROR" || issue.severity === "CRITICAL";
}

export class CoreHealthBlockedError extends Error {
  readonly blockingIssues: string[];

  constructor(message: string, blockingIssues: string[]) {
    super(message);
    this.name = "CoreHealthBlockedError";
    this.blockingIssues = blockingIssues;
  }
}
