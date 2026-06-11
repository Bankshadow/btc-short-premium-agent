export const SAFETY_LABELS = [
  "TESTNET ONLY",
  "LIVE LOCKED",
  "HUMAN CONFIRM REQUIRED",
  "MIROFISH ADVISORY ONLY",
  "NO AUTO-EXECUTE",
  "REDUCE-ONLY CLOSE REQUIRED",
] as const;

export function SafetyLabelsBar({ className = "" }: { className?: string }) {
  return (
    <div className={`ui-safety-labels ${className}`.trim()} role="note" aria-label="Safety labels">
      {SAFETY_LABELS.map((label) => (
        <span key={label} className="ui-safety-label">
          {label}
        </span>
      ))}
    </div>
  );
}
