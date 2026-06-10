import { appendEvent, getEvents } from "@/lib/journal/journal-query";
import type { JournalEvent } from "@/lib/journal/journal-types";
import { CoreValidationError } from "./core-errors";
import type { CoreAppendInput } from "./event-types";
import { attachCoreMetadata } from "./event-types";
import { validateBeforeAppend, type EventValidationOptions } from "./event-validator";

export interface AppendCoreEventOptions extends EventValidationOptions {
  /** When true, reject append on validation errors. Default false for backward compatibility. */
  strict?: boolean;
  attachMetadata?: boolean;
}

export async function readCoreEvents(): Promise<JournalEvent[]> {
  return getEvents();
}

export async function appendCoreEvent(
  input: CoreAppendInput,
  options: AppendCoreEventOptions = {},
): Promise<JournalEvent> {
  const existing = options.existingEvents ?? (await getEvents());
  const toValidate = options.attachMetadata !== false ? attachCoreMetadata(input) : input;
  const result = validateBeforeAppend(toValidate, existing, options);

  if (!result.valid && options.strict) {
    throw new CoreValidationError(
      "EVENT_VALIDATION_FAILED",
      "Event failed core validation.",
      result.issues,
    );
  }

  return appendEvent(result.normalized ?? toValidate);
}

export async function appendCoreEventStrict(
  input: CoreAppendInput,
  options: Omit<AppendCoreEventOptions, "strict"> = {},
): Promise<JournalEvent> {
  return appendCoreEvent(input, { ...options, strict: true });
}
