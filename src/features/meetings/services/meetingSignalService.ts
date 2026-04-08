import { supabase } from "../../../lib/supabase/client";

type SignalType = "offer" | "answer" | "ice-candidate";

export async function sendMeetingSignal(params: {
  meetingId: string;
  senderId: string;
  receiverId: string;
  signalType: SignalType;
  payload: unknown;
}) {
  console.log("SENDING SIGNAL:", {
    meetingId: params.meetingId,
    from: params.senderId,
    to: params.receiverId,
    type: params.signalType,
    payload: params.payload,
  });

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
  onSignal: (signal: {
    id: string;
    meeting_id: string;
    sender_id: string;
    receiver_id: string;
    signal_type: SignalType;
    payload: unknown;
  }) => void | Promise<void>;
}) {
  const channel = supabase.channel(
    `meeting-signals:${params.meetingId}:${params.currentUserId}`,
  );

  channel
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "meeting_signals",
        filter: `meeting_id=eq.${params.meetingId}`,
      },
      async (payload) => {
        const signal = payload.new as {
          id: string;
          meeting_id: string;
          sender_id: string;
          receiver_id: string;
          signal_type: SignalType;
          payload: unknown;
        };

        if (!signal) return;
        if (signal.receiver_id !== params.currentUserId) return;
        if (signal.sender_id === params.currentUserId) return;

        console.log("RECEIVED SIGNAL:", {
          id: signal.id,
          meetingId: signal.meeting_id,
          from: signal.sender_id,
          to: signal.receiver_id,
          type: signal.signal_type,
          payload: signal.payload,
        });

        await params.onSignal(signal);

        const { error } = await supabase
          .from("meeting_signals")
          .delete()
          .eq("id", signal.id);

        if (error) {
          console.error("FAILED TO DELETE SIGNAL:", error);
        }
      },
    )
    .subscribe((status) => {
      console.log(
        `SIGNAL CHANNEL STATUS [${params.meetingId}:${params.currentUserId}]:`,
        status,
      );
    });

  return () => {
    void supabase.removeChannel(channel);
  };
}