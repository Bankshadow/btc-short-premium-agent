import type { DeskBackboneRecord } from "../types";

let memoryRecord: DeskBackboneRecord | null = null;

export function readMemoryBackbone(): DeskBackboneRecord | null {
  return memoryRecord;
}

export function writeMemoryBackbone(record: DeskBackboneRecord): DeskBackboneRecord {
  memoryRecord = record;
  return record;
}

export function clearMemoryBackbone(): void {
  memoryRecord = null;
}
