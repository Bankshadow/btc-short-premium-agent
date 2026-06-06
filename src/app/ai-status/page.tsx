import AIStatusView from "@/components/goal/AIStatusView";

export const metadata = {
  title: "AI Status · AI Trading Mission",
  description: "Plain-language view of what the AI is doing and which engines need attention.",
};

export default function AIStatusPage() {
  return (
    <main className="desk-root min-h-screen">
      <AIStatusView />
    </main>
  );
}
