import { promoteQuantImport } from "@/lib/quant-strategy-importer/promote-import";
import { getSeedById } from "@/lib/quant-strategy-importer/build-catalog";
import type { PromoteTournamentWinnerInput } from "./types";

export async function promoteTournamentWinner(
  input: PromoteTournamentWinnerInput,
): Promise<{
  ok: boolean;
  message: string;
  executionBlocked: true;
}> {
  if (!input.humanApproval) {
    return {
      ok: false,
      message: "Human approval required to promote tournament winner.",
      executionBlocked: true,
    };
  }

  if (input.sourceId === "ai-desk-options-premium") {
    return {
      ok: true,
      message:
        "AI Desk strategy is already the live desk primary (options_short_premium). Review on /strategy-health — no quant import promotion needed.",
      executionBlocked: true,
    };
  }

  const seed = getSeedById(input.sourceId);
  if (!seed) {
    return {
      ok: false,
      message: `Unknown tournament sourceId: ${input.sourceId}`,
      executionBlocked: true,
    };
  }

  const result = await promoteQuantImport({
    sourceId: input.sourceId,
    targetStatus: "READY_FOR_PAPER",
    humanApproval: true,
    operatorNote:
      input.operatorNote ??
      `Tournament winner promoted to paper review (${input.sourceId})`,
  });

  return {
    ok: result.ok,
    message: result.message,
    executionBlocked: true,
  };
}
