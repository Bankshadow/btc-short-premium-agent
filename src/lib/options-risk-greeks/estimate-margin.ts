import type { MarginEstimate } from "./types";
import type { OptionGreekSnapshot } from "./types";

export function estimatePortfolioMargin(input: {
  positions: OptionGreekSnapshot[];
  walletBalanceUsd?: number | null;
}): MarginEstimate {
  const perPosition = input.positions.reduce((s, p) => s + p.marginUsd, 0);
  const balance = input.walletBalanceUsd ?? null;
  const estimable =
    input.positions.length === 0 ||
    input.positions.every((p) => p.estimable && p.marginUsd >= 0);

  return {
    totalMarginUsd: Number(perPosition.toFixed(2)),
    availableBalanceUsd: balance,
    marginUsagePct:
      balance && balance > 0
        ? Number(((perPosition / balance) * 100).toFixed(1))
        : null,
    perPositionMarginUsd: Number(perPosition.toFixed(2)),
    sufficient: balance == null ? null : perPosition <= balance,
    estimable,
  };
}
