import { supabase } from "../../../lib/supabase/client";
import type {
  MeetingMessage,
  MeetingWithParticipants,
} from "../types/meeting";
import { getMeetingById, getMeetingMessages } from "./meetingService";

export function subscribeToMeetingRoom(params: {
  meetingId: string;
  onMeetingChange: (meeting: MeetingWithParticipants | null) => void;
  onMessagesChange?: (messages: MeetingMessage[]) => void;
  onMeetingEnded?: () => void;
  onError?: (message: string) => void;
}) {
  const channel = supabase.channel(`meeting-room:${params.meetingId}`);

  let refreshingMeeting = false;
  let refreshingMessages = false;

  const refreshMeeting = async () => {
    if (refreshingMeeting) return;
    refreshingMeeting = true;

    try {
      const meeting = await getMeetingById(params.meetingId);
      params.onMeetingChange(meeting);

      if (
        meeting &&
        (meeting.status === "ended" || meeting.status === "cancelled")
      ) {
        params.onMeetingEnded?.();
      }
    } catch (err: any) {
      params.onError?.(err?.message || "Failed to refresh meeting state.");
    } finally {
      refreshingMeeting = false;
    }
  };

  const refreshMessages = async () => {
    if (refreshingMessages) return;
    refreshingMessages = true;

    try {
      const messages = await getMeetingMessages(params.meetingId);
      params.onMessagesChange?.(messages);
    } catch (err: any) {
      params.onError?.(err?.message || "Failed to refresh meeting messages.");
    } finally {
      refreshingMessages = false;
    }
  };

  channel
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "meetings",
        filter: `id=eq.${params.meetingId}`,
      },
      async () => {
        await refreshMeeting();
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
      async () => {
        await refreshMeeting();
      },
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "meeting_messages",
        filter: `meeting_id=eq.${params.meetingId}`,
      },
      async () => {
        await refreshMessages();
      },
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void refreshMeeting();
        void refreshMessages();
      }
    });

  return () => {
    void supabase.removeChannel(channel);
  };
}