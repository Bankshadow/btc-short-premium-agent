import type { CouncilProposalStatus, CouncilSessionResult } from "./types";

export const COUNCIL_SESSIONS_STORAGE_KEY =
  "trading-agents-crypto-desk:council-sessions";

export function loadCouncilSessions(): CouncilSessionResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(COUNCIL_SESSIONS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CouncilSessionResult[];
  } catch {
    return [];
  }
}

export function saveCouncilSession(session: CouncilSessionResult): CouncilSessionResult[] {
  const next = [session, ...loadCouncilSessions()].slice(0, 30);
  if (typeof window !== "undefined") {
    localStorage.setItem(COUNCIL_SESSIONS_STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

export function updateProposalStatus(
  sessionId: string,
  proposalId: string,
  status: CouncilProposalStatus,
): CouncilSessionResult | null {
  const sessions = loadCouncilSessions();
  let updated: CouncilSessionResult | null = null;
  const next = sessions.map((s) => {
    if (s.councilSessionId !== sessionId) return s;
    updated = {
      ...s,
      proposals: s.proposals.map((p) =>
        p.id === proposalId ? { ...p, status } : p,
      ),
    };
    return updated;
  });
  if (typeof window !== "undefined") {
    localStorage.setItem(COUNCIL_SESSIONS_STORAGE_KEY, JSON.stringify(next));
  }
  return updated;
}
