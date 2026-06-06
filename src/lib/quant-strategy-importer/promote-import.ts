import { buildQuantImporterCatalog, getSeedById } from "./build-catalog";
import { convertSeedToCard } from "./convert-to-card";
import { saveImportStatusOverride } from "./importer-store";
import {
  assertHumanApproval,
  assertImportExecutionBlocked,
  buildBacktestUrl,
  canTransitionImportStatus,
} from "./safety";
import type { PromoteImportInput, PromoteImportResult } from "./types";

export async function promoteQuantImport(
  input: PromoteImportInput,
): Promise<PromoteImportResult> {
  assertImportExecutionBlocked();

  const approvalError = assertHumanApproval(input);
  if (approvalError) {
    return {
      ok: false,
      card: null,
      backtestUrl: null,
      message: approvalError,
      executionBlocked: true,
    };
  }

  const seed = getSeedById(input.sourceId);
  if (!seed) {
    return {
      ok: false,
      card: null,
      backtestUrl: null,
      message: `Unknown import sourceId: ${input.sourceId}`,
      executionBlocked: true,
    };
  }

  const catalog = await buildQuantImporterCatalog();
  const current = catalog.strategies.find((s) => s.sourceId === input.sourceId);
  const fromStatus = current?.importStatus ?? "RESEARCH_ONLY";

  if (!canTransitionImportStatus(fromStatus, input.targetStatus)) {
    return {
      ok: false,
      card: current ?? null,
      backtestUrl: null,
      message: `Cannot transition ${fromStatus} → ${input.targetStatus}.`,
      executionBlocked: true,
    };
  }

  const saved = await saveImportStatusOverride({
    sourceId: input.sourceId,
    importStatus: input.targetStatus,
    operatorNote: input.operatorNote,
  });

  const card = convertSeedToCard(seed, saved.importStatus, saved.lastReviewedAt);
  const backtestUrl =
    input.targetStatus === "READY_FOR_BACKTEST"
      ? buildBacktestUrl(input.sourceId)
      : null;

  const message =
    input.targetStatus === "READY_FOR_BACKTEST"
      ? `Promoted to backtest queue. Open ${backtestUrl} for historical replay (research only).`
      : input.targetStatus === "READY_FOR_PAPER"
        ? "Marked ready for paper — still requires separate human approval before testnet."
        : input.targetStatus === "REJECTED"
          ? "Strategy rejected and blocked from promotion."
          : "Status updated.";

  return {
    ok: true,
    card,
    backtestUrl,
    message,
    executionBlocked: true,
  };
}
