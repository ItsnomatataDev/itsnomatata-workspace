import { useState } from "react";
import { Camera, Mic, X, Check, X as XIcon } from "lucide-react";
import {
  respondToCameraRequest,
  respondToMicrophoneRequest,
} from "../services/meetingSignalService";

interface MeetingRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: {
    type: "camera" | "microphone";
    requestId: string;
    requestedBy: string;
    reason?: string;
    hostName?: string;
  };
  meetingId: string;
  participantId: string;
  hostId: string;
}

export default function MeetingRequestModal({
  isOpen,
  onClose,
  request,
  meetingId,
  participantId,
  hostId,
}: MeetingRequestModalProps) {
  const [isResponding, setIsResponding] = useState(false);

  const handleAccept = async () => {
    if (!request.requestId) return;
    
    setIsResponding(true);
    try {
      if (request.type === "camera") {
        await respondToCameraRequest({
          meetingId,
          participantId,
          hostId,
          requestId: request.requestId,
          accepted: true,
        });
      } else {
        await respondToMicrophoneRequest({
          meetingId,
          participantId,
          hostId,
          requestId: request.requestId,
          accepted: true,
        });
      }
      onClose();
    } catch (error) {
      console.error("Failed to accept request:", error);
    } finally {
      setIsResponding(false);
    }
  };

  const handleDecline = async () => {
    if (!request.requestId) return;
    
    setIsResponding(true);
    try {
      if (request.type === "camera") {
        await respondToCameraRequest({
          meetingId,
          participantId,
          hostId,
          requestId: request.requestId,
          accepted: false,
        });
      } else {
        await respondToMicrophoneRequest({
          meetingId,
          participantId,
          hostId,
          requestId: request.requestId,
          accepted: false,
        });
      }
      onClose();
    } catch (error) {
      console.error("Failed to decline request:", error);
    } finally {
      setIsResponding(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl border border-white/10 bg-neutral-950 p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
              request.type === "camera" 
                ? "bg-blue-500/20 text-blue-400" 
                : "bg-green-500/20 text-green-400"
            }`}>
              {request.type === "camera" ? <Camera size={20} /> : <Mic size={20} />}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                {request.type === "camera" ? "Camera Request" : "Microphone Request"}
              </h3>
              <p className="text-sm text-white/60">
                From {request.hostName || "the meeting host"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Message */}
        <div className="mb-6">
          <p className="text-white">
            {request.reason || 
             (request.type === "camera" 
               ? "The meeting host is requesting you to turn on your camera."
               : "The meeting host is requesting you to turn on your microphone."
             )
            }
          </p>
          <p className="mt-2 text-sm text-white/60">
            You can choose to accept or decline this request.
          </p>
        </div>

        {/* Privacy Note */}
        <div className="mb-6 rounded-xl border border-orange-500/20 bg-orange-500/10 p-3">
          <p className="text-xs leading-relaxed text-orange-300">
            <strong>Privacy Note:</strong> Your camera/microphone will only be enabled if you accept this request. You can turn it off at any time using your device controls.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleDecline}
            disabled={isResponding}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="flex items-center justify-center gap-2">
              <XIcon size={16} />
              <span>Decline</span>
            </div>
          </button>
          <button
            type="button"
            onClick={handleAccept}
            disabled={isResponding}
            className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold text-black transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              request.type === "camera"
                ? "bg-blue-500 hover:bg-blue-400"
                : "bg-green-500 hover:bg-green-400"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              {isResponding ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <Check size={16} />
              )}
              <span>{isResponding ? "Responding..." : "Accept"}</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
