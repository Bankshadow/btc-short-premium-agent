import { buildEvidenceProgressFromEvents } from "@/lib/evidence/evidence-progress-engine";
import type { JournalEvent } from "@/lib/journal/journal-types";
import type { EvidenceProgress } from "@/lib/evidence/evidence-types";

export function buildEvidenceProjection(events: JournalEvent[]): EvidenceProgress {
  return buildEvidenceProgressFromEvents(events);
}

export function zeroEvidenceProjection(): EvidenceProgress {
  return buildEvidenceProgressFromEvents([]);
}
