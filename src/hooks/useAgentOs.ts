"use client";

import { useCallback, useMemo, useState } from "react";
import { buildAgentOsDashboardState } from "@/lib/agent-os/build-agent-os-state";
import { evaluateAllPermissions, evaluatePermission } from "@/lib/agent-os/permission-matrix";
import { loadAgentOsSettings } from "@/lib/agent-os/settings-store";
import { appendClientAuditEvent } from "@/lib/agent-os/audit-client";
import {
  grantOnceApproval,
  grantSessionApproval,
  hasOnceApproval,
  hasSessionApproval,
  consumeOnceApproval,
} from "@/lib/agent-os/session-approvals";
import type {
  AgentOsAction,
  AgentOsDashboardState,
  AgentOsModeInput,
  PermissionMatrixResult,
  PermissionPromptRequest,
} from "@/lib/agent-os/types";
import { emitClientAiStatusEvent } from "@/lib/ai-status/event-client";
import type { PermissionDecision } from "@/components/agent-os/PermissionPrompt";

export interface UseAgentOsInput extends AgentOsModeInput {
  currentAction?: string;
  nextAction?: string;
  goalProgressPct?: number | null;
  pendingAction?: AgentOsAction | null;
  testnetTradesToday?: number;
  linkedTradeId?: string | null;
  linkedDecisionId?: string | null;
}

export function useAgentOs(input: UseAgentOsInput) {
  const settings = loadAgentOsSettings();
  const [promptOpen, setPromptOpen] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<PermissionPromptRequest | null>(null);
  const [pendingCallback, setPendingCallback] = useState<(() => void) | null>(null);

  const enrichedInput = useMemo(
    () => ({
      ...input,
      observeOnly: input.observeOnly ?? settings.observeOnly,
      testnetAllowAllSafe: input.testnetAllowAllSafe ?? settings.testnetAllowAllSafe,
      testnetAllowAllExplicitlyEnabled:
        input.testnetAllowAllExplicitlyEnabled ?? settings.testnetAllowAllExplicitlyEnabled,
      maxAutoTestnetTradesPerDay: settings.maxAutoTestnetTradesPerDay,
      sessionApproved: input.pendingAction
        ? hasSessionApproval(input.pendingAction)
        : false,
      onceApproved: input.pendingAction
        ? hasOnceApproval(input.pendingAction)
        : false,
    }),
    [input, settings],
  );

  const state: AgentOsDashboardState = useMemo(
    () => buildAgentOsDashboardState(enrichedInput),
    [enrichedInput],
  );

  const matrix: PermissionMatrixResult[] = useMemo(
    () =>
      evaluateAllPermissions({
        mode: state.mode,
        testnetTradesToday: input.testnetTradesToday,
        maxAutoTestnetTradesPerDay: settings.maxAutoTestnetTradesPerDay,
      }),
    [state.mode, input.testnetTradesToday, settings.maxAutoTestnetTradesPerDay],
  );

  const checkPermission = useCallback(
    (action: AgentOsAction) =>
      evaluatePermission(action, {
        mode: state.mode,
        testnetTradesToday: input.testnetTradesToday,
        maxAutoTestnetTradesPerDay: settings.maxAutoTestnetTradesPerDay,
        sessionApproved: hasSessionApproval(action),
        onceApproved: hasOnceApproval(action),
      }),
    [state.mode, input.testnetTradesToday, settings.maxAutoTestnetTradesPerDay],
  );

  const requestPermission = useCallback(
    (
      action: AgentOsAction,
      prompt: PermissionPromptRequest,
      onApproved: () => void,
    ) => {
      const perm = checkPermission(action);
      if (perm.allowed) {
        onApproved();
        return;
      }
      if (!perm.requiresPermission) {
        return;
      }
      emitClientAiStatusEvent({
        type: "PERMISSION_REQUESTED",
        detail: prompt.title,
        linkedDecisionId: prompt.linkedDecisionId,
        linkedTradeId: prompt.linkedTradeId,
        technical: `action=${action}`,
      });
      setPendingPrompt(prompt);
      setPendingCallback(() => onApproved);
      setPromptOpen(true);
    },
    [checkPermission],
  );

  const handlePermissionDecision = useCallback(
    async (decision: PermissionDecision) => {
      if (!pendingPrompt) return;
      const action = pendingPrompt.action;

      if (decision === "approve_once") {
        grantOnceApproval(action);
      } else if (decision === "approve_session") {
        grantSessionApproval(action);
      }

      const approved = decision !== "deny";
      appendClientAuditEvent({
        action,
        approved,
        actor: "operator",
        reason:
          decision === "deny"
            ? "Operator denied"
            : decision === "approve_session"
              ? "Approved for session"
              : decision === "approve_once"
                ? "Approved once"
                : "Approved",
        linkedTradeId: pendingPrompt.linkedTradeId ?? null,
        linkedDecisionId: pendingPrompt.linkedDecisionId ?? null,
        approvalScope:
          decision === "deny"
            ? "denied"
            : decision === "approve_session"
              ? "session"
              : "once",
        mode: state.mode,
      });

      void fetch("/api/agent-os/permission", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          approved,
          actor: "operator",
          approvalScope:
            decision === "deny"
              ? "denied"
              : decision === "approve_session"
                ? "session"
                : "once",
          modeInput: enrichedInput,
          linkedTradeId: pendingPrompt.linkedTradeId,
          linkedDecisionId: pendingPrompt.linkedDecisionId,
        }),
      }).catch(() => undefined);

      setPromptOpen(false);
      setPendingPrompt(null);

      if (approved) {
        if (decision === "approve_once") consumeOnceApproval(action);
        pendingCallback?.();
      }
      setPendingCallback(null);
    },
    [pendingPrompt, pendingCallback, state.mode, enrichedInput],
  );

  return {
    state,
    matrix,
    settings,
    checkPermission,
    requestPermission,
    promptOpen,
    pendingPrompt,
    handlePermissionDecision,
    closePrompt: () => setPromptOpen(false),
  };
}
