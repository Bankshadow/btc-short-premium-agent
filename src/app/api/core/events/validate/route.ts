import { NextResponse } from "next/server";
import { readCoreEvents } from "@/lib/core/event-store";
import { validateRawCoreEvent } from "@/lib/core/event-validator";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { event?: unknown };
    if (body.event === undefined) {
      return NextResponse.json({ error: "Provide event in body." }, { status: 400 });
    }

    const existing = await readCoreEvents();
    const result = validateRawCoreEvent(body.event, {
      checkSecrets: true,
      checkLiveLeak: true,
      checkCorrelation: true,
      checkLifecycle: true,
      existingEvents: existing,
    });

    return NextResponse.json({
      valid: result.valid,
      normalizedEvent: result.normalizedEvent,
      errors: result.errors,
      warnings: result.warnings,
      lifecycleState: result.lifecycleState ?? null,
      invalidTransitions: result.invalidTransitions ?? [],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Validation failed" },
      { status: 500 },
    );
  }
}
