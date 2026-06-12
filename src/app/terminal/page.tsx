import { getTerminalBundle } from "@/lib/terminal/terminal-projection-builder";
import { TerminalClient } from "./terminal-client";

export const dynamic = "force-dynamic";

export default async function TerminalPage() {
  const initialBundle = await getTerminalBundle();
  return <TerminalClient initialBundle={initialBundle} />;
}
