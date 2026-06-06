import type {
  HealthDimensionScore,
  HealthLevel,
  LiveTradingPosture,
  ObservabilitySignals,
  PlatformHealthReport,
} from "./types";

function levelFromScore(score: number): HealthLevel {
  if (score >= 80) return "HEALTHY";
  if (score >= 50) return "DEGRADED";
  return "CRITICAL";
}

function scorePlatform(signals: ObservabilitySignals): HealthDimensionScore {
  const issues: string[] = [];
  let score = 100;
  if (!signals.api.cronConfigured) {
    score -= 15;
    issues.push("CRON_SECRET not configured — scheduled automation unavailable.");
  }
  if (signals.errorRate1h > 5) {
    score -= 20;
    issues.push(`${signals.errorRate1h} errors in the last hour.`);
  }
  return {
    dimension: "platform",
    level: levelFromScore(score),
    score: Math.max(0, score),
    summary: issues.length === 0 ? "Platform services operational." : issues[0],
    issues,
  };
}

function scoreTrading(signals: ObservabilitySignals): HealthDimensionScore {
  const issues = [...signals.liveBlockers];
  let score = issues.length === 0 ? 95 : Math.max(20, 90 - issues.length * 20);
  if (signals.policyBlocks1h > 3) {
    score -= 15;
    issues.push(`${signals.policyBlocks1h} policy blocks in the last hour.`);
  }
  return {
    dimension: "trading",
    level: levelFromScore(score),
    score: Math.max(0, score),
    summary:
      issues.length === 0
        ? "Trading posture clear — paper learning active."
        : issues[0],
    issues,
  };
}

function scoreData(signals: ObservabilitySignals): HealthDimensionScore {
  const issues: string[] = [];
  let score = 100;
  if (signals.database.liveExecutionBlocked) {
    score = 10;
    issues.push(
      signals.database.liveBlockReason ?? "Database write health blocks live.",
    );
  } else if (signals.database.writeFailures > 0) {
    score -= 30;
    issues.push(`${signals.database.writeFailures} warehouse write failure(s).`);
  }
  if (signals.marketData.staleWarning) {
    score -= 25;
    issues.push(signals.marketData.staleWarning);
  }
  if (signals.marketData.dataTrustGrade === "CRITICAL") {
    score -= 40;
    issues.push("Data trust CRITICAL.");
  }
  return {
    dimension: "data",
    level: levelFromScore(score),
    score: Math.max(0, score),
    summary: issues.length === 0 ? "Data pipeline healthy." : issues[0],
    issues,
  };
}

function scoreAutomation(signals: ObservabilitySignals): HealthDimensionScore {
  const issues: string[] = [];
  let score = 100;
  if (signals.automation.paused) {
    score -= 20;
    issues.push("Automation control plane paused.");
  }
  if (signals.automation.failedJobCount > 0) {
    score -= Math.min(50, signals.automation.failedJobCount * 15);
    issues.push(`${signals.automation.failedJobCount} failed job(s) pending retry.`);
  }
  for (const t of signals.automation.consecutiveFailureTypes) {
    issues.push(`Repeated failures: ${t}`);
    score -= 10;
  }
  return {
    dimension: "automation",
    level: levelFromScore(score),
    score: Math.max(0, score),
    summary:
      issues.length === 0 ? "Automation jobs healthy." : issues[0],
    issues,
  };
}

function scoreRisk(signals: ObservabilitySignals): HealthDimensionScore {
  const issues = signals.liveBlockers.filter(
    (b) =>
      b.toLowerCase().includes("kill") ||
      b.toLowerCase().includes("risk") ||
      b.toLowerCase().includes("policy"),
  );
  let score = issues.length === 0 ? 95 : Math.max(15, 85 - issues.length * 25);
  if (signals.policyBlocks1h > 0 && issues.length === 0) {
    score -= 10;
    issues.push(`${signals.policyBlocks1h} policy block(s) recently.`);
  }
  return {
    dimension: "risk",
    level: levelFromScore(score),
    score: Math.max(0, score),
    summary: issues.length === 0 ? "Risk gates clear." : issues[0],
    issues,
  };
}

function scoreIntegration(signals: ObservabilitySignals): HealthDimensionScore {
  const issues: string[] = [];
  let score = 100;
  if (!signals.exchange.configured) {
    score -= 25;
    issues.push("Exchange API not configured.");
  } else if (!signals.exchange.connected) {
    score -= 45;
    issues.push(signals.exchange.error ?? "Exchange disconnected.");
  }
  if (!signals.alerts.anyChannelConfigured) {
    score -= 30;
    issues.push("No alert channel configured.");
  } else if (signals.alerts.recentDeliveryFailures > 0) {
    score -= 25;
    issues.push(
      `${signals.alerts.recentDeliveryFailures} alert delivery failure(s).`,
    );
  }
  return {
    dimension: "integration",
    level: levelFromScore(score),
    score: Math.max(0, score),
    summary:
      issues.length === 0 ? "Integrations connected." : issues[0],
    issues,
  };
}

export function resolveLiveTradingPosture(
  dimensions: HealthDimensionScore[],
  signals: ObservabilitySignals,
): LiveTradingPosture {
  if (signals.database.liveExecutionBlocked) return "BLOCKED";
  const trading = dimensions.find((d) => d.dimension === "trading");
  const risk = dimensions.find((d) => d.dimension === "risk");
  const integration = dimensions.find((d) => d.dimension === "integration");
  if (
    trading?.level === "CRITICAL" ||
    risk?.level === "CRITICAL" ||
    signals.liveBlockers.length > 2
  ) {
    return "BLOCKED";
  }
  if (
    integration?.level === "CRITICAL" ||
    integration?.level === "DEGRADED" ||
    !signals.alerts.anyChannelConfigured ||
    signals.alerts.recentDeliveryFailures > 0
  ) {
    return "CAUTION";
  }
  if (trading?.level === "DEGRADED" || risk?.level === "DEGRADED") {
    return "CAUTION";
  }
  return "SAFE";
}

export function buildPlatformHealthReport(
  signals: ObservabilitySignals,
): PlatformHealthReport {
  const dimensions = [
    scorePlatform(signals),
    scoreTrading(signals),
    scoreData(signals),
    scoreAutomation(signals),
    scoreRisk(signals),
    scoreIntegration(signals),
  ];
  const overallScore = Math.round(
    dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length,
  );
  const overallLevel = levelFromScore(overallScore);
  const liveTradingPosture = resolveLiveTradingPosture(dimensions, signals);

  const commandCenterShouldBlock =
    liveTradingPosture === "BLOCKED" ||
    dimensions.some(
      (d) =>
        (d.dimension === "trading" || d.dimension === "risk") &&
        d.level === "CRITICAL",
    ) ||
    signals.database.liveExecutionBlocked;

  const safetyNotices: string[] = [];
  if (signals.database.liveExecutionBlocked) {
    safetyNotices.push("Database health failure — live trading BLOCKED.");
  }
  if (liveTradingPosture === "CAUTION" && !signals.alerts.anyChannelConfigured) {
    safetyNotices.push("Alert delivery unavailable — live trading CAUTION.");
  }
  if (commandCenterShouldBlock) {
    safetyNotices.push("Critical observability signal — command center BLOCKED.");
  }

  return {
    generatedAt: new Date().toISOString(),
    workspaceId: signals.workspaceId,
    overallScore,
    overallLevel,
    liveTradingPosture,
    dimensions,
    signals,
    commandCenterShouldBlock,
    safetyNotices,
  };
}
