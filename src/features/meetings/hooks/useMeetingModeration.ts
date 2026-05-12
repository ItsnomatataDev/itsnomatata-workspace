import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../../app/providers/AuthProvider";
import { subscribeToMeetingSignals, type SignalType } from "../services/meetingSignalService";

interface ModerationRequest {
  type: "camera" | "microphone";
  requestId: string;
  requestedBy: string;
  reason?: string;
  timestamp: string;
}

interface UseMeetingModerationOptions {
  meetingId: string;
  isHost: boolean;
}

interface UseMeetingModerationReturn {
  currentRequest: ModerationRequest | null;
  hasPendingRequest: boolean;
  onRequestHandled: () => void;
  updateRequestStatus: (participantId: string, type: "camera" | "microphone", status: "accepted" | "declined") => void;
  requestStatuses: Map<string, Map<"camera" | "microphone", "pending" | "accepted" | "declined">>;
}

export function useMeetingModeration({
  meetingId,
  isHost,
}: UseMeetingModerationOptions): UseMeetingModerationReturn {
  const { user } = useAuth();
  const [currentRequest, setCurrentRequest] = useState<ModerationRequest | null>(null);
  const [requestStatuses, setRequestStatuses] = useState<Map<string, Map<"camera" | "microphone", "pending" | "accepted" | "declined">>>(new Map());
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const onRequestHandled = useCallback(() => {
    setCurrentRequest(null);
  }, []);

  const updateRequestStatus = useCallback((
    participantId: string, 
    type: "camera" | "microphone", 
    status: "accepted" | "declined"
  ) => {
    setRequestStatuses(prev => {
      const newMap = new Map(prev);
      const participantMap = newMap.get(participantId) || new Map();
      participantMap.set(type, status);
      newMap.set(participantId, participantMap);
      return newMap;
    });
  }, []);

  const handleSignal = useCallback(async (signal: {
    id: string;
    meeting_id: string;
    sender_id: string;
    receiver_id: string;
    signal_type: SignalType;
    payload: unknown;
  }) => {
    if (!user?.id) return;

    const payload = signal.payload as any;
    
    switch (signal.signal_type) {
      case "request_camera_on":
        if (signal.receiver_id === user.id) {
          setCurrentRequest({
            type: "camera",
            requestId: payload.requestId,
            requestedBy: signal.sender_id,
            reason: payload.reason,
            timestamp: payload.timestamp,
          });
        }
        break;

      case "request_microphone_on":
        if (signal.receiver_id === user.id) {
          setCurrentRequest({
            type: "microphone",
            requestId: payload.requestId,
            requestedBy: signal.sender_id,
            reason: payload.reason,
            timestamp: payload.timestamp,
          });
        }
        break;

      case "camera_request_accepted":
        if (signal.sender_id === user.id) {
          updateRequestStatus(signal.receiver_id, "camera", "accepted");
        }
        break;

      case "camera_request_declined":
        if (signal.sender_id === user.id) {
          updateRequestStatus(signal.receiver_id, "camera", "declined");
        }
        break;

      case "microphone_request_accepted":
        if (signal.sender_id === user.id) {
          updateRequestStatus(signal.receiver_id, "microphone", "accepted");
        }
        break;

      case "microphone_request_declined":
        if (signal.sender_id === user.id) {
          updateRequestStatus(signal.receiver_id, "microphone", "declined");
        }
        break;

      case "force_camera_off":
        if (signal.receiver_id === user.id) {
          // Force camera off - this should be handled by the media hook
          console.log("Host forced camera off");
          // You could emit a custom event here for the media hook to listen to
          window.dispatchEvent(new CustomEvent("forceCameraOff", {
            detail: { reason: payload.reason }
          }));
        }
        break;

      case "force_mute":
        if (signal.receiver_id === user.id) {
          // Force mute - this should be handled by the media hook
          console.log("Host forced mute");
          // You could emit a custom event here for the media hook to listen to
          window.dispatchEvent(new CustomEvent("forceMute", {
            detail: { reason: payload.reason }
          }));
        }
        break;

      case "remove_participant":
        if (signal.receiver_id === user.id) {
          // Participant removed - navigate away from meeting
          console.log("Removed from meeting:", payload.reason);
          window.location.href = "/meetings";
        }
        break;

      default:
        // Handle WebRTC signals (offer, answer, ice-candidate) in the appropriate hook
        break;
    }
  }, [user?.id, updateRequestStatus]);

  useEffect(() => {
    if (!meetingId || !user?.id) return;

    // Subscribe to meeting signals
    unsubscribeRef.current = subscribeToMeetingSignals({
      meetingId,
      currentUserId: user.id,
      onSignal: handleSignal,
    });

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [meetingId, user?.id, handleSignal]);

  return {
    currentRequest,
    hasPendingRequest: !!currentRequest,
    onRequestHandled,
    updateRequestStatus,
    requestStatuses,
  };
}
