import CronConfigView from "@/components/settings/CronConfigView";

export const metadata = {
  title: "Cron & Agents · Settings",
  description: "Configure automation interval and view AI agent roster.",
};

export default function CronSettingsPage() {
  return (
    <main className="desk-root min-h-screen">
      <CronConfigView />
    </main>
  );
}
