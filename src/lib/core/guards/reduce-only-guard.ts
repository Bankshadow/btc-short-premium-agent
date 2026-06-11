export function checkReduceOnlyGuard(preview: {
  reduceOnly?: boolean;
} | null): { blocked: boolean; reason: string | null } {
  if (!preview) {
    return { blocked: true, reason: "Close preview not found." };
  }
  if (preview.reduceOnly !== true) {
    return {
      blocked: true,
      reason: "Close preview must have reduceOnly=true.",
    };
  }
  return { blocked: false, reason: null };
}
