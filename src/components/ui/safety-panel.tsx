import { StatusBadge, statusFromHealth, type StatusTone } from "./status-badge";
import { SectionCard } from "./section-card";

export interface SafetyItem {
  title: string;
  value: string;
  detail?: string;
  tone: StatusTone;
}

export function SafetyPanel({
  items,
  headerAddon,
  zeroState,
}: {
  items: SafetyItem[];
  headerAddon?: string;
  zeroState?: boolean;
}) {
  return (
    <SectionCard
      title="Core Safety Status"
      addon={headerAddon ?? "TESTNET"}
      tone={statusFromHealth(headerAddon)}
      zeroState={zeroState}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.title} className={`ui-safety-item ui-safety-${item.tone}`}>
            <div className="ui-safety-item-head">
              <StatusBadge label={item.title} tone={item.tone} />
            </div>
            <p className="ui-safety-value">{item.value}</p>
            {item.detail ? <p className="ui-safety-detail">{item.detail}</p> : null}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
