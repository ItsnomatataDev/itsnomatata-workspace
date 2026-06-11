import type { TimeEntryItem } from "../supabase/mutations/timeEntries";

export const TIMER_STATE_CHANGED_EVENT = "itsnomatata:timer-state-changed";

export type TimerStateChangedDetail = {
  action: "started" | "stopped" | "resumed" | "manual" | "updated";
  entry?: TimeEntryItem | null;
  organizationId?: string | null;
  userId?: string | null;
  taskId?: string | null;
};

export function notifyTimerStateChanged(detail: TimerStateChangedDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<TimerStateChangedDetail>(TIMER_STATE_CHANGED_EVENT, {
      detail,
    }),
  );
}
