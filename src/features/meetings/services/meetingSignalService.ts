import { supabase } from "../../../lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type MeetingSignalType = "offer" | "answer" | "ice-candidate";

export type MeetingSignalPayload = {
  id: string;
  meeting_id: string;
  sender_id: string;
  receiver_id: string;
  signal_type: MeetingSignalType;
  payload: Record<string, unknown>;
  created_at: string;
};

export async function sendMeetingSignal(params: {
  meetingId: string;
  senderId: string;
  receiverId: string;
  signalType: MeetingSignalType;
  payload: Record<string, unknown>;
}) {
  const { error } = await supabase.from("meeting_signals").insert({
    meeting_id: params.meetingId,
    sender_id: params.senderId,
    receiver_id: params.receiverId,
    signal_type: params.signalType,
    payload: params.payload,
  });

  if (error) throw error;
}

export function subscribeToMeetingSignals(params: {
  meetingId: string;
  currentUserId: string;
  onSignal: (signal: MeetingSignalPayload) => void;
}) {
  const channel: RealtimeChannel = supabase
    .channel(`meeting-signals:${params.meetingId}:${params.currentUserId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "meeting_signals",
        filter: `receiver_id=eq.${params.currentUserId}`,
      },
      (payload) => {
        const signal = payload.new as MeetingSignalPayload;

        if (signal.meeting_id !== params.meetingId) return;
        params.onSignal(signal);
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}