import { supabase } from "../../../lib/supabase/client";

export type SignalType = "offer" | "answer" | "ice-candidate" | 
  "request_camera_on" | "request_microphone_on" | 
  "camera_request_accepted" | "camera_request_declined" |
  "microphone_request_accepted" | "microphone_request_declined" |
  "force_camera_off" | "force_mute" | "remove_participant";

export interface ModerationSignal {
  type: SignalType;
  payload?: {
    requestId?: string;
    reason?: string;
    requestedBy?: string;
    timestamp?: string;
  };
}

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

// Moderation-specific functions
export async function sendModerationSignal(params: {
  meetingId: string;
  senderId: string;
  receiverId: string;
  signal: ModerationSignal;
}) {
  return sendMeetingSignal({
    meetingId: params.meetingId,
    senderId: params.senderId,
    receiverId: params.receiverId,
    signalType: params.signal.type,
    payload: params.signal.payload,
  });
}

export async function requestCameraOn(params: {
  meetingId: string;
  hostId: string;
  participantId: string;
  reason?: string;
}) {
  return sendModerationSignal({
    meetingId: params.meetingId,
    senderId: params.hostId,
    receiverId: params.participantId,
    signal: {
      type: "request_camera_on",
      payload: {
        requestId: crypto.randomUUID(),
        reason: params.reason,
        requestedBy: params.hostId,
        timestamp: new Date().toISOString(),
      },
    },
  });
}

export async function requestMicrophoneOn(params: {
  meetingId: string;
  hostId: string;
  participantId: string;
  reason?: string;
}) {
  return sendModerationSignal({
    meetingId: params.meetingId,
    senderId: params.hostId,
    receiverId: params.participantId,
    signal: {
      type: "request_microphone_on",
      payload: {
        requestId: crypto.randomUUID(),
        reason: params.reason,
        requestedBy: params.hostId,
        timestamp: new Date().toISOString(),
      },
    },
  });
}

export async function respondToCameraRequest(params: {
  meetingId: string;
  participantId: string;
  hostId: string;
  requestId: string;
  accepted: boolean;
}) {
  return sendModerationSignal({
    meetingId: params.meetingId,
    senderId: params.participantId,
    receiverId: params.hostId,
    signal: {
      type: params.accepted ? "camera_request_accepted" : "camera_request_declined",
      payload: {
        requestId: params.requestId,
        timestamp: new Date().toISOString(),
      },
    },
  });
}

export async function respondToMicrophoneRequest(params: {
  meetingId: string;
  participantId: string;
  hostId: string;
  requestId: string;
  accepted: boolean;
}) {
  return sendModerationSignal({
    meetingId: params.meetingId,
    senderId: params.participantId,
    receiverId: params.hostId,
    signal: {
      type: params.accepted ? "microphone_request_accepted" : "microphone_request_declined",
      payload: {
        requestId: params.requestId,
        timestamp: new Date().toISOString(),
      },
    },
  });
}

export async function forceCameraOff(params: {
  meetingId: string;
  hostId: string;
  participantId: string;
  reason?: string;
}) {
  return sendModerationSignal({
    meetingId: params.meetingId,
    senderId: params.hostId,
    receiverId: params.participantId,
    signal: {
      type: "force_camera_off",
      payload: {
        reason: params.reason,
        requestedBy: params.hostId,
        timestamp: new Date().toISOString(),
      },
    },
  });
}

export async function forceMute(params: {
  meetingId: string;
  hostId: string;
  participantId: string;
  reason?: string;
}) {
  return sendModerationSignal({
    meetingId: params.meetingId,
    senderId: params.hostId,
    receiverId: params.participantId,
    signal: {
      type: "force_mute",
      payload: {
        reason: params.reason,
        requestedBy: params.hostId,
        timestamp: new Date().toISOString(),
      },
    },
  });
}

export async function removeParticipant(params: {
  meetingId: string;
  hostId: string;
  participantId: string;
  reason?: string;
}) {
  return sendModerationSignal({
    meetingId: params.meetingId,
    senderId: params.hostId,
    receiverId: params.participantId,
    signal: {
      type: "remove_participant",
      payload: {
        reason: params.reason,
        requestedBy: params.hostId,
        timestamp: new Date().toISOString(),
      },
    },
  });
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