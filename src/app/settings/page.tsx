import SettingsView from "@/components/goal/SettingsView";

export const metadata = {
  title: "Settings · AI Trading Mission",
  description: "Configure mission, environment visibility, risk limits, and notifications.",
};

export default function SettingsPage() {
  return (
    <main className="desk-root min-h-screen">
      <SettingsView />
    </main>
  );
}
