import { isPortfolioRiskBlocking } from "@/lib/portfolio-risk/portfolio-risk-manager";

export async function checkPortfolioRiskGuard(): Promise<{ blocked: boolean; reason: string | null }> {
  const blocked = await isPortfolioRiskBlocking();
  return {
    blocked,
    reason: blocked ? "Portfolio risk blocks execution." : null,
  };
}
