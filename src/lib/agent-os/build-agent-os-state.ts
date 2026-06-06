import { AGENT_OS_MODE_DESCRIPTIONS, AGENT_OS_MODE_LABELS } from "./mode-rules";
import { evaluatePermission } from "./permission-matrix";
import { resolveAgentOsMode } from "./resolve-mode";
import type {
  AgentOsAction,
  AgentOsDashboardState,
  AgentOsModeInput,
  PermissionPromptRequest,
} from "./types";

export interface BuildAgentOsStateInput extends AgentOsModeInput {
  currentAction?: string;
  nextAction?: string;
  goalProgressPct?: number | null;
  pendingAction?: AgentOsAction | null;
  testnetTradesToday?: number;
  maxAutoTestnetTradesPerDay?: number;
  sessionApproved?: boolean;
  onceApproved?: boolean;
  linkedTradeId?: string | null;
  linkedDecisionId?: string | null;
}

function buildPendingPrompt(
  action: AgentOsAction,
  input: BuildAgentOsStateInput,
): PermissionPromptRequest | null {
  const prompts: Partial<Record<AgentOsAction, Omit<PermissionPromptRequest, "action">>> = {
    EXECUTE_TESTNET_ORDER: {
      title: "Execute testnet order",
      why: "AI committee recommends a testnet trade based on current market analysis.",
      risk: "Testnet capital at risk; fills may differ from preview. Live remains locked.",
      expectedResult: "Order placed on Binance testnet within approved notional limits.",
      sessionSafe: true,
    },
    CLOSE_TESTNET_POSITION: {
      title: "Close testnet position",
      why: "AI monitor suggests closing an open testnet position.",
      risk: "Realized PnL may differ from mark; reversal cost applies.",
      expectedResult: "Position closed on testnet; PnL recorded for learning.",
      sessionSafe: true,
    },
    CREATE_TESTNET_PREVIEW: {
      title: "Create testnet preview",
      why: "AI wants to stage a testnet order preview for your review.",
      risk: "No order until you approve execute.",
      expectedResult: "Preview queued — execute requires separate approval.",
      sessionSafe: true,
    },
    CHANGE_STRATEGY: {
      title: "Change active strategy",
      why: "AI or operator proposes a strategy registry change.",
      risk: "May alter committee gates and trade frequency.",
      expectedResult: "Strategy registry updated after approval.",
      sessionSafe: false,
    },
    CHANGE_RISK_LIMIT: {
      title: "Change risk limit",
      why: "AI suggests adjusting desk risk parameters.",
      risk: "Higher limits increase exposure; lower limits may block trades.",
      expectedResult: "Risk profile updated for subsequent cycles.",
      sessionSafe: false,
    },
    SEND_CURSOR_TASK: {
      title: "Send Cursor automation task",
      why: "AI wants to dispatch a Cursor task for desk maintenance.",
      risk: "External automation — review task scope before approving.",
      expectedResult: "Task queued to Cursor with desk context.",
      sessionSafe: false,
    },
    ENABLE_LIVE: {
      title: "Enable live trading",
      why: "Live enable requested.",
      risk: "Real capital at risk.",
      expectedResult: "Blocked — live is permanently locked.",
      sessionSafe: false,
    },
  };

  const template = prompts[action];
  if (!template) return null;
  return {
    action,
    ...template,
    linkedTradeId: input.linkedTradeId,
    linkedDecisionId: input.linkedDecisionId,
  };
}

export function buildAgentOsDashboardState(
  input: BuildAgentOsStateInput = {},
): AgentOsDashboardState {
  const mode = resolveAgentOsMode(input);
  const pendingAction = input.pendingAction ?? null;

  const permission = pendingAction
    ? evaluatePermission(pendingAction, {
        mode,
        testnetTradesToday: input.testnetTradesToday,
        maxAutoTestnetTradesPerDay: input.maxAutoTestnetTradesPerDay,
        sessionApproved: input.sessionApproved,
        onceApproved: input.onceApproved,
      })
    : null;

  const permissionNeeded = permission?.requiresPermission === true && !permission.allowed;

  const thinksActsAsks = {
    think:
      mode === "OBSERVE"
        ? "Watching market — no analysis cycles."
        : "Analyze market, regime, and strategy context before recommending.",
    act:
      mode === "OBSERVE" || mode === "ANALYZE"
        ? "No automatic trades — decisions only."
        : mode === "PAPER_AUTOPILOT"
          ? "Paper and shadow records only."
          : mode === "TESTNET_ASSISTED"
            ? "Auto preview; execute/close asks permission."
            : "Auto testnet within daily safe limits; AI self-check each action.",
    ask:
      permissionNeeded
        ? "Waiting for operator approval on risky action."
        : "Risky actions prompt before proceeding. Live always locked.",
  };

  return {
    mode,
    modeLabel: AGENT_OS_MODE_LABELS[mode],
    currentAction: input.currentAction ?? thinksActsAsks.think,
    permissionNeeded,
    nextAction: input.nextAction ?? "Stand by for next desk cycle.",
    goalProgressPct: input.goalProgressPct ?? null,
    liveLocked: true,
    thinksActsAsks,
    pendingPermission:
      permissionNeeded && pendingAction
        ? buildPendingPrompt(pendingAction, input)
        : null,
  };
}

export function describeAgentOsMode(mode: import("./types").AgentOsMode): string {
  return AGENT_OS_MODE_DESCRIPTIONS[mode];
}
