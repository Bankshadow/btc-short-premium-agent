import { promoteQuantImport } from "@/lib/quant-strategy-importer/promote-import";
import { saveImportStatusOverride } from "@/lib/quant-strategy-importer/importer-store";
import { promoteFromShadow } from "@/lib/strategy-shadow/promote-shadow";
import { getGarageCard } from "./build-garage-catalog";
import { upsertGarageRecord } from "./garage-store";
import type { PromoteGarageInput, PromoteGarageResult, StrategyGarageStage } from "./types";

function mapStageToImportStatus(
  stage: StrategyGarageStage,
): "READY_FOR_BACKTEST" | "READY_FOR_PAPER" | "REJECTED" | null {
  switch (stage) {
    case "BACKTEST_READY":
      return "READY_FOR_BACKTEST";
    case "TESTNET_READY":
      return "READY_FOR_PAPER";
    case "REJECTED":
      return "REJECTED";
    default:
      return null;
  }
}

export async function promoteGarageStrategy(
  input: PromoteGarageInput,
): Promise<PromoteGarageResult> {
  if (!input.humanApproval) {
    return {
      ok: false,
      message: "Human approval is required for all garage promotions.",
      card: null,
      executionBlocked: true,
    };
  }

  const card = await getGarageCard(input.sourceId);
  if (!card) {
    return {
      ok: false,
      message: `Strategy not found: ${input.sourceId}`,
      card: null,
      executionBlocked: true,
    };
  }

  if (input.targetStage === "APPROVED_FOR_USE") {
    if (card.stage !== "TESTNET_READY" && card.importStatus !== "READY_FOR_PAPER") {
      return {
        ok: false,
        message: "Strategy must reach TESTNET_READY before AI loop approval.",
        card,
        executionBlocked: true,
      };
    }
    await upsertGarageRecord(input.sourceId, {
      stage: "APPROVED_FOR_USE",
      approvedForAiLoop: true,
      approvedForAiLoopAt: new Date().toISOString(),
      operatorNote: input.operatorNote,
    });
    const updated = await getGarageCard(input.sourceId);
    return {
      ok: true,
      message:
        "Approved for AI decision loop (advisory signals only). Direct execution remains blocked.",
      card: updated,
      executionBlocked: true,
    };
  }

  if (input.targetStage === "REJECTED") {
    await saveImportStatusOverride({
      sourceId: input.sourceId,
      importStatus: "REJECTED",
      operatorNote: input.operatorNote,
    });
    await upsertGarageRecord(input.sourceId, {
      stage: "REJECTED",
      importStatus: "REJECTED",
      approvedForAiLoop: false,
      operatorNote: input.operatorNote,
    });
    const updated = await getGarageCard(input.sourceId);
    return {
      ok: true,
      message: "Strategy rejected — blocked from promotion and AI loop.",
      card: updated,
      executionBlocked: true,
    };
  }

  if (input.targetStage === "SHADOW_TESTING") {
    const shadow = await promoteFromShadow({
      sourceId: input.sourceId,
      humanApproval: true,
      operatorNote: input.operatorNote,
      targetStatus: "READY_FOR_BACKTEST",
    });
    if (!shadow.ok) {
      return {
        ok: false,
        message: shadow.message,
        card,
        executionBlocked: true,
      };
    }
    await upsertGarageRecord(input.sourceId, {
      stage: "SHADOW_TESTING",
      operatorNote: input.operatorNote,
    });
    const updated = await getGarageCard(input.sourceId);
    return {
      ok: true,
      message: shadow.message,
      card: updated,
      executionBlocked: true,
    };
  }

  const importStatus = mapStageToImportStatus(input.targetStage);
  if (importStatus) {
    const result = await promoteQuantImport({
      sourceId: input.sourceId,
      targetStatus: importStatus,
      humanApproval: true,
      operatorNote: input.operatorNote,
    });
    if (!result.ok) {
      await saveImportStatusOverride({
        sourceId: input.sourceId,
        importStatus,
        operatorNote: input.operatorNote,
      });
    }
    await upsertGarageRecord(input.sourceId, {
      stage: input.targetStage,
      importStatus,
      operatorNote: input.operatorNote,
    });
    const updated = await getGarageCard(input.sourceId);
    return {
      ok: true,
      message: result.ok ? result.message : `Garage stage updated (import hub: ${result.message})`,
      card: updated,
      executionBlocked: true,
    };
  }

  await upsertGarageRecord(input.sourceId, {
    stage: input.targetStage,
    operatorNote: input.operatorNote,
  });
  const updated = await getGarageCard(input.sourceId);
  return {
    ok: true,
    message: `Stage updated to ${input.targetStage}.`,
    card: updated,
    executionBlocked: true,
  };
}
