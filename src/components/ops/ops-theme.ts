export type OpsAccent =
  | "amber"
  | "violet"
  | "indigo"
  | "rose"
  | "teal"
  | "cyan"
  | "emerald";

export const OPS_ACCENT: Record<
  OpsAccent,
  {
    badge: string;
    icon: string;
    ring: string;
    glow: string;
    btn: string;
    link: string;
    progress: string;
  }
> = {
  amber: {
    badge: "text-amber-300/90",
    icon: "from-amber-500/35 to-orange-600/20 ring-amber-500/35 text-amber-100",
    ring: "ring-amber-500/25",
    glow: "shadow-[0_0_40px_-12px_rgba(217,119,6,0.35)]",
    btn: "bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-zinc-950",
    link: "border-amber-900/50 bg-amber-950/30 text-amber-300/90 hover:bg-amber-900/35",
    progress: "bg-amber-500",
  },
  violet: {
    badge: "text-violet-300/90",
    icon: "from-violet-500/35 to-fuchsia-600/20 ring-violet-500/35 text-violet-100",
    ring: "ring-violet-500/25",
    glow: "shadow-[0_0_40px_-12px_rgba(139,92,246,0.35)]",
    btn: "bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-500 hover:to-violet-600 text-zinc-50",
    link: "border-violet-900/50 bg-violet-950/30 text-violet-300/90 hover:bg-violet-900/35",
    progress: "bg-violet-500",
  },
  indigo: {
    badge: "text-indigo-300/90",
    icon: "from-indigo-500/35 to-blue-600/20 ring-indigo-500/35 text-indigo-100",
    ring: "ring-indigo-500/25",
    glow: "shadow-[0_0_40px_-12px_rgba(99,102,241,0.35)]",
    btn: "bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-zinc-50",
    link: "border-indigo-900/50 bg-indigo-950/30 text-indigo-300/90 hover:bg-indigo-900/35",
    progress: "bg-indigo-500",
  },
  rose: {
    badge: "text-rose-300/90",
    icon: "from-rose-500/35 to-red-600/20 ring-rose-500/35 text-rose-100",
    ring: "ring-rose-500/25",
    glow: "shadow-[0_0_40px_-12px_rgba(244,63,94,0.35)]",
    btn: "bg-gradient-to-r from-rose-700 to-rose-800 hover:from-rose-600 hover:to-rose-700 text-zinc-50",
    link: "border-rose-900/50 bg-rose-950/30 text-rose-300/90 hover:bg-rose-900/35",
    progress: "bg-rose-500",
  },
  teal: {
    badge: "text-teal-300/90",
    icon: "from-teal-500/35 to-cyan-600/20 ring-teal-500/35 text-teal-100",
    ring: "ring-teal-500/25",
    glow: "shadow-[0_0_40px_-12px_rgba(20,184,166,0.35)]",
    btn: "bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-500 hover:to-teal-600 text-zinc-50",
    link: "border-teal-900/50 bg-teal-950/30 text-teal-300/90 hover:bg-teal-900/35",
    progress: "bg-teal-500",
  },
  cyan: {
    badge: "text-cyan-300/90",
    icon: "from-cyan-500/35 to-sky-600/20 ring-cyan-500/35 text-cyan-100",
    ring: "ring-cyan-500/25",
    glow: "shadow-[0_0_40px_-12px_rgba(6,182,212,0.35)]",
    btn: "bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-500 hover:to-cyan-600 text-zinc-950",
    link: "border-cyan-900/50 bg-cyan-950/30 text-cyan-300/90 hover:bg-cyan-900/35",
    progress: "bg-cyan-500",
  },
  emerald: {
    badge: "text-emerald-300/90",
    icon: "from-emerald-500/35 to-teal-600/20 ring-emerald-500/35 text-emerald-100",
    ring: "ring-emerald-500/25",
    glow: "shadow-[0_0_40px_-12px_rgba(16,185,129,0.35)]",
    btn: "bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-zinc-950",
    link: "border-emerald-900/50 bg-emerald-950/30 text-emerald-300/90 hover:bg-emerald-900/35",
    progress: "bg-emerald-500",
  },
};

export const OPS_MODULE_LINKS = [
  { href: "/", label: "Cockpit", accent: "amber" as OpsAccent },
  { href: "/autopilot", label: "Autopilot", accent: "cyan" as OpsAccent },
  { href: "/actions", label: "Actions", accent: "indigo" as OpsAccent },
  { href: "/notifications", label: "Alerts", accent: "amber" as OpsAccent },
  { href: "/worker", label: "Worker", accent: "cyan" as OpsAccent },
  { href: "/command-center", label: "Command", accent: "rose" as OpsAccent },
  { href: "/real-time-risk", label: "Risk RT", accent: "rose" as OpsAccent },
  { href: "/warehouse", label: "Warehouse", accent: "indigo" as OpsAccent },
  { href: "/automation", label: "Automation", accent: "cyan" as OpsAccent },
  { href: "/desk-manager", label: "Desk Mgr", accent: "cyan" as OpsAccent },
  { href: "/portfolio", label: "Portfolio", accent: "teal" as OpsAccent },
  { href: "/assets", label: "Assets", accent: "emerald" as OpsAccent },
  { href: "/council", label: "Council", accent: "amber" as OpsAccent },
  { href: "/mortem", label: "Mortem", accent: "emerald" as OpsAccent },
  { href: "/simulation", label: "Simulation", accent: "violet" as OpsAccent },
  { href: "/backtest", label: "Backtest", accent: "violet" as OpsAccent },
  { href: "/risk-budget", label: "Risk Budget", accent: "rose" as OpsAccent },
  { href: "/war-room", label: "War room", accent: "rose" as OpsAccent },
  { href: "/capital", label: "Capital", accent: "violet" as OpsAccent },
  { href: "/adaptation", label: "Adaptation", accent: "indigo" as OpsAccent },
  { href: "/memory-graph", label: "Memory", accent: "violet" as OpsAccent },
  { href: "/learning", label: "Learning", accent: "teal" as OpsAccent },
  { href: "/performance-intelligence", label: "Perf Intel", accent: "violet" as OpsAccent },
  { href: "/regime-brain", label: "Regime", accent: "indigo" as OpsAccent },
  { href: "/rule-discovery", label: "Rules", accent: "indigo" as OpsAccent },
  { href: "/experiments", label: "Experiments", accent: "violet" as OpsAccent },
  { href: "/live-readiness", label: "Live ready", accent: "emerald" as OpsAccent },
  { href: "/live-pilot", label: "Live pilot", accent: "emerald" as OpsAccent },
  { href: "/live-scale-up", label: "Scale-up", accent: "emerald" as OpsAccent },
  { href: "/live-supervisor", label: "Supervisor", accent: "rose" as OpsAccent },
  { href: "/options-live-readiness", label: "Options ready", accent: "violet" as OpsAccent },
  { href: "/options-testnet", label: "Options TN", accent: "cyan" as OpsAccent },
  { href: "/binance-testnet", label: "Binance TN", accent: "cyan" as OpsAccent },
  { href: "/options-dry-run", label: "Options DR", accent: "violet" as OpsAccent },
  { href: "/options-risk", label: "Options Risk", accent: "violet" as OpsAccent },
  { href: "/strategies", label: "Strategies", accent: "indigo" as OpsAccent },
  { href: "/validation", label: "Validation", accent: "teal" as OpsAccent },
  { href: "/governance", label: "Governance", accent: "rose" as OpsAccent },
  { href: "/workspace", label: "Workspace", accent: "cyan" as OpsAccent },
  { href: "/reports", label: "Reports", accent: "cyan" as OpsAccent },
] as const;
