import type { AiStatusEventType } from "./types";

export const AI_STATUS_EVENT_LABELS: Record<AiStatusEventType, string> = {
  ANALYSIS_STARTED: "Analysis started",
  MARKET_FETCHED: "Market data fetched",
  AGENTS_REVIEWED: "Agents reviewed market",
  RISK_CHECKED: "Risk manager checked gates",
  TRADE_CANDIDATE_CREATED: "Trade candidate created",
  TESTNET_PREVIEW_CREATED: "Testnet preview created",
  PERMISSION_REQUESTED: "Permission requested",
  ORDER_EXECUTED: "Testnet order executed",
  POSITION_MONITORED: "Position monitored",
  TRADE_CLOSED: "Trade closed",
  LEARNING_UPDATED: "Learning updated",
};

export const AI_STATUS_STEP_LABELS: Record<AiStatusEventType, string> = {
  ANALYSIS_STARTED: "Starting AI cycle",
  MARKET_FETCHED: "Fetching market context",
  AGENTS_REVIEWED: "Committee deliberation",
  RISK_CHECKED: "Risk gate review",
  TRADE_CANDIDATE_CREATED: "Building trade candidate",
  TESTNET_PREVIEW_CREATED: "Staging testnet preview",
  PERMISSION_REQUESTED: "Awaiting operator approval",
  ORDER_EXECUTED: "Executing on testnet",
  POSITION_MONITORED: "Monitoring open position",
  TRADE_CLOSED: "Closing trade",
  LEARNING_UPDATED: "Updating learning loop",
};

export const AI_STATUS_PROGRESS: Record<AiStatusEventType, number> = {
  ANALYSIS_STARTED: 10,
  MARKET_FETCHED: 25,
  AGENTS_REVIEWED: 50,
  RISK_CHECKED: 65,
  TRADE_CANDIDATE_CREATED: 78,
  TESTNET_PREVIEW_CREATED: 88,
  PERMISSION_REQUESTED: 92,
  ORDER_EXECUTED: 96,
  POSITION_MONITORED: 85,
  TRADE_CLOSED: 100,
  LEARNING_UPDATED: 100,
};
