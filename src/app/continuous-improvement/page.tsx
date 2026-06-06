import OpsShell from "@/components/ops/OpsShell";
import ContinuousImprovementPanel from "@/components/continuous-improvement/ContinuousImprovementPanel";

export const metadata = {
  title: "Continuous Improvement | Desk",
  description:
    "AI detects product and trading issues, committee reviews, and generates Cursor-ready improvement tasks.",
};

export default function ContinuousImprovementPage() {
  return (
    <OpsShell
      badge="MVP 87 · AI Continuous Improvement Loop"
      title="Continuous Improvement"
      subtitle="Detect → committee review → proposal → Cursor prompt → human approve → verify. No auto-merge or live enablement."
      accent="violet"
      iconLetters="CI"
      activePath="/continuous-improvement"
      nav={[
        { href: "/project-strategist", label: "Project strategist" },
        { href: "/cockpit", label: "Cockpit" },
        { href: "/reports", label: "Reports" },
      ]}
    >
      <ContinuousImprovementPanel />
    </OpsShell>
  );
}
