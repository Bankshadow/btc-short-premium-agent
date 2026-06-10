import fs from "node:fs";
import path from "node:path";
import type {
  MvpIntegrationContract,
  MvpCheckKind,
  MvpCheckResult,
  MvpValidationResult,
  NoOrphanMvpReport,
} from "./types";
import { NO_ORPHAN_MVP_RULE_LABEL } from "./types";
import { MVP_INTEGRATION_REGISTRY } from "./mvp-registry";

function readFileIfExists(root: string, relPath: string): string | null {
  const full = path.join(root, relPath);
  try {
    if (!fs.existsSync(full)) return null;
    return fs.readFileSync(full, "utf8");
  } catch {
    return null;
  }
}

function validateCheck(
  root: string,
  check: MvpIntegrationContract["checks"][number],
): MvpCheckResult {
  const existing: { path: string; content: string }[] = [];
  for (const rel of check.paths) {
    const content = readFileIfExists(root, rel);
    if (content != null) existing.push({ path: rel, content });
  }

  if (existing.length === 0) {
    return {
      kind: check.kind,
      label: check.label,
      passed: false,
      required: check.required,
      detail: `No file found among: ${check.paths.join(", ")}`,
    };
  }

  if (check.mustContain) {
    const matched = existing.find((f) => f.content.includes(check.mustContain!));
    if (!matched) {
      return {
        kind: check.kind,
        label: check.label,
        passed: false,
        required: check.required,
        detail: `Missing "${check.mustContain}" in ${existing.map((f) => f.path).join(", ")}`,
      };
    }
    return {
      kind: check.kind,
      label: check.label,
      passed: true,
      required: check.required,
      detail: `Found in ${matched.path}`,
    };
  }

  return {
    kind: check.kind,
    label: check.label,
    passed: true,
    required: check.required,
    detail: `Found ${existing[0].path}`,
  };
}

function detectOrphanUiOnly(contract: MvpIntegrationContract, checks: MvpCheckResult[]): boolean {
  const hasUi =
    checks.find((c) => c.kind === "dashboard_visibility")?.passed ||
    checks.find((c) => c.kind === "reports_visibility")?.passed;
  const hasData = checks.find((c) => c.kind === "data_source")?.passed;
  const hasWrite = checks.find((c) => c.kind === "write_path")?.passed;
  const hasApi = checks.find((c) => c.kind === "route_or_api")?.passed;
  return Boolean(hasUi && !hasData && !hasWrite && !hasApi);
}

export function validateMvpIntegrationContract(
  contract: MvpIntegrationContract,
  projectRoot: string,
): MvpValidationResult {
  const checks = contract.checks.map((c) => validateCheck(projectRoot, c));

  if (contract.tradeAffecting) {
    const riskCheck = checks.find((c) => c.kind === "risk_permission_check");
    if (!riskCheck) {
      checks.push({
        kind: "risk_permission_check",
        label: "Trade-affecting MVP requires risk check",
        passed: false,
        required: true,
        detail: "No risk_permission_check defined in contract",
      });
    }
  }

  const failures = checks
    .filter((c) => c.required && !c.passed)
    .map((c) => `[${c.kind}] ${c.label}: ${c.detail}`);

  const orphanRisk = detectOrphanUiOnly(contract, checks);
  if (orphanRisk) {
    failures.push("Orphan UI-only MVP: dashboard/reports without API, data source, or write path");
  }

  return {
    mvpId: contract.mvpId,
    name: contract.name,
    passed: failures.length === 0,
    orphanRisk,
    checks,
    failures,
  };
}

export function validateAllRegisteredMvps(
  projectRoot: string = process.cwd(),
): NoOrphanMvpReport {
  const results = MVP_INTEGRATION_REGISTRY.map((c) =>
    validateMvpIntegrationContract(c, projectRoot),
  );
  const orphanMvps = results.filter((r) => !r.passed || r.orphanRisk).map((r) => r.mvpId);

  return {
    rule: NO_ORPHAN_MVP_RULE_LABEL,
    validatedAt: new Date().toISOString(),
    allPassed: orphanMvps.length === 0,
    orphanMvps,
    results,
  };
}

/** Fail-fast helper for CI — throws when any registered MVP is orphaned. */
export function assertNoOrphanMvps(projectRoot: string = process.cwd()): NoOrphanMvpReport {
  const report = validateAllRegisteredMvps(projectRoot);
  if (!report.allPassed) {
    const lines = report.results
      .filter((r) => !r.passed)
      .flatMap((r) => [`MVP ${r.mvpId} ${r.name}:`, ...r.failures.map((f) => `  - ${f}`)]);
    throw new Error(`No Orphan MVP Rule failed:\n${lines.join("\n")}`);
  }
  return report;
}

export function validateNewMvpContract(
  contract: MvpIntegrationContract,
  projectRoot: string = process.cwd(),
): MvpValidationResult {
  const requiredKinds = new Set<MvpCheckKind>([
    "route_or_api",
    "data_source",
    "write_path",
    "dashboard_visibility",
    "reports_visibility",
    "journal_event",
    "single_source_of_truth",
  ]);
  if (contract.tradeAffecting) requiredKinds.add("risk_permission_check");

  const present = new Set(contract.checks.map((c) => c.kind));
  const result = validateMvpIntegrationContract(contract, projectRoot);
  for (const kind of requiredKinds) {
    if (!present.has(kind)) {
      result.failures.push(`Missing required check kind: ${kind}`);
      result.passed = false;
    }
  }
  return result;
}
