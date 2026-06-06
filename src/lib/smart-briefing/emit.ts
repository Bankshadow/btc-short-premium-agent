import { appendSmartNotification } from "./notification-store";
import { buildSmartNotification } from "./format-message";
import { dispatchBriefingFromClient } from "./dispatch";
import { loadSmartBriefingSettings } from "./settings-store";
import { shouldNotifyForEvent } from "./should-notify";
import type {
  SmartBriefingDispatchResult,
  SmartBriefingPayload,
} from "./types";

export async function emitSmartBriefing(
  payload: SmartBriefingPayload,
  options?: { skipExternal?: boolean },
): Promise<SmartBriefingDispatchResult> {
  const settings = loadSmartBriefingSettings();
  const gate = shouldNotifyForEvent(payload.eventType, settings);

  if (!gate.notify) {
    return {
      notification: buildSmartNotification(payload),
      dispatched: false,
      skipped: true,
      skipReason: gate.reason,
      channelResults: {},
    };
  }

  let channelResults: Record<string, boolean | string> = {};
  if (!options?.skipExternal && typeof window !== "undefined") {
    channelResults = await dispatchBriefingFromClient(payload);
  }

  const notification = buildSmartNotification(payload, channelResults);
  appendSmartNotification(notification);

  return {
    notification,
    dispatched: true,
    skipped: false,
    skipReason: null,
    channelResults,
  };
}
