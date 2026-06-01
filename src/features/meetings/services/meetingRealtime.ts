import { supabase } from "../../../lib/supabase/client";
import type { MeetingWithParticipants } from "../types/meeting";
import { getMeetingById } from "./meetingService";

const MEETING_REFRESH_DEBOUNCE_MS = 800;

function debounce<T extends (...args: never[]) => void>(fn: T, waitMs: number) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      timeoutId = null;
      fn(...args);
    }, waitMs);
  };
}

export function subscribeToMeetingRoom(params: {
  meetingId: string;
  onMeetingChange: (meeting: MeetingWithParticipants | null) => void;
  onMeetingEnded?: () => void;
  onError?: (message: string) => void;
}) {
  const channel = supabase.channel(`meeting-room:${params.meetingId}`);

  let refreshInFlight = false;

  const refreshMeeting = async () => {
    if (refreshInFlight) return;
    refreshInFlight = true;

    try {
      const meeting = await getMeetingById(params.meetingId);
      params.onMeetingChange(meeting);

      if (
        meeting &&
        (meeting.status === "ended" || meeting.status === "cancelled")
      ) {
        params.onMeetingEnded?.();
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to refresh meeting state.";
      params.onError?.(message);
    } finally {
      refreshInFlight = false;
    }
  };

  const scheduleRefresh = debounce(() => {
    void refreshMeeting();
  }, MEETING_REFRESH_DEBOUNCE_MS);

  channel
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "meetings",
        filter: `id=eq.${params.meetingId}`,
      },
      () => {
        scheduleRefresh();
      },
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "meeting_participants",
        filter: `meeting_id=eq.${params.meetingId}`,
      },
      () => {
        scheduleRefresh();
      },
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void refreshMeeting();
      }
    });

  return () => {
    void supabase.removeChannel(channel);
  };
}
