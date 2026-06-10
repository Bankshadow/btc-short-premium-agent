import AdvancedModuleLayout from "@/components/advanced/AdvancedModuleLayout";
import ApiDocsDashboard from "@/components/trading-os/ApiDocsDashboard";

export const metadata = {
  title: "API docs · Trading OS",
  description: "HTTP API contract for the AI Trading Desk OS.",
};

export default function ApiDocsPage() {
  return (
    <main className="min-h-full bg-zinc-950">
      <AdvancedModuleLayout moduleId="api-docs">
        <ApiDocsDashboard />
      </AdvancedModuleLayout>
    </main>
  );
}
