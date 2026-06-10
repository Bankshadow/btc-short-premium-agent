import { appendEvent, getEvents } from "@/lib/journal/journal-query";
import { buildMissionSnapshot } from "@/lib/mission/mission-snapshot";
import { loadScenarioContext } from "@/lib/analysis/scenario-context";
import { newCollaborationId } from "@/lib/journal/journal-types";
import { classifyRegime } from "@/lib/regime/regime-classifier";
import { retrieveRegimeMemory } from "@/lib/regime/regime-retrieval";
import { getLatestSwarmReport } from "@/lib/skills/mirofish-swarm/swarm-runner";
import { createAgentCritiques, extractDissent } from "./agent-critique";
import {
  createAgentProposals,
  createExecutionProposal,
  createLearningProposal,
} from "./agent-proposal";
import { buildCommitteeSummary } from "./committee-summary";
import type { CommitteeSummary } from "./collaboration-types";

export async function runCollaborationLoop(runId?: string): Promise<CommitteeSummary> {
  const collaborationId = newCollaborationId();
  const events = await getEvents();
  const mission = buildMissionSnapshot(events);
  const scenario = await loadScenarioContext();
  const swarm = await getLatestSwarmReport();
  const regime = classifyRegime({ mission, swarmReport: swarm });
  const memory = await retrieveRegimeMemory(regime);

  const proposals = [
    ...createAgentProposals({ mission, scenario, regime }),
    createExecutionProposal(mission),
    createLearningProposal(memory.lessons),
  ];

  for (const p of proposals) {
    await appendEvent({
      type: "AGENT_PROPOSAL_CREATED",
      environment: "testnet",
      runId,
      payload: { collaborationId, ...p },
    });
  }

  const critiques = createAgentCritiques({ proposals, scenario, regime });
  for (const c of critiques) {
    await appendEvent({
      type: "AGENT_CRITIQUE_CREATED",
      environment: "testnet",
      runId,
      payload: { collaborationId, ...c },
    });
  }

  const summary = buildCommitteeSummary({
    collaborationId,
    runId: runId ?? collaborationId,
    proposals,
    critiques,
  });

  await appendEvent({
    type: "AGENT_CONSENSUS_CREATED",
    environment: "testnet",
    runId,
    payload: {
      ...summary,
      dissentCount: extractDissent(critiques).length,
    },
  });

  return summary;
}

export async function getLatestCollaboration(): Promise<CommitteeSummary | null> {
  const events = await getEvents();
  const evt = [...events]
    .filter((e) => e.type === "AGENT_CONSENSUS_CREATED")
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
  if (!evt) return null;
  return evt.payload as unknown as CommitteeSummary;
}
