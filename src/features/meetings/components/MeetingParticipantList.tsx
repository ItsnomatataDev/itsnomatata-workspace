import { useState } from "react";
import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  MoreVertical,
  UserMinus,
  Volume2,
  X,
} from "lucide-react";
import { useAuth } from "../../../app/providers/AuthProvider";
import UserAvatar from "../../../components/common/UserAvatar";
import type { MeetingParticipant } from "../types/meeting";
import {
  requestCameraOn,
  requestMicrophoneOn,
  forceCameraOff,
  forceMute,
  removeParticipant,
} from "../services/meetingSignalService";

interface MeetingParticipantListProps {
  participants: MeetingParticipant[];
  meetingId: string;
  isHost: boolean;
  onParticipantRemove?: (participantId: string) => void;
}

interface ParticipantRequest {
  participantId: string;
  type: "camera" | "microphone";
  requestId: string;
  status: "pending" | "accepted" | "declined";
}

export default function MeetingParticipantList({
  participants,
  meetingId,
  isHost,
  onParticipantRemove,
}: MeetingParticipantListProps) {
  const { user } = useAuth();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [pendingRequests, setPendingRequests] = useState<ParticipantRequest[]>([]);

  const canModerate = isHost;

  const handleRequestCamera = async (participantId: string) => {
    if (!canModerate || !user?.id) return;
    
    try {
      await requestCameraOn({
        meetingId,
        hostId: user.id,
        participantId,
        reason: "Host requests you to turn on your camera",
      });

      // Track the request
      const requestId = crypto.randomUUID();
      setPendingRequests(prev => [...prev, {
        participantId,
        type: "camera",
        requestId,
        status: "pending"
      }]);

      setActiveMenu(null);
    } catch (error) {
      console.error("Failed to request camera:", error);
    }
  };

  const handleRequestMicrophone = async (participantId: string) => {
    if (!canModerate || !user?.id) return;
    
    try {
      await requestMicrophoneOn({
        meetingId,
        hostId: user.id,
        participantId,
        reason: "Host requests you to turn on your microphone",
      });

      // Track the request
      const requestId = crypto.randomUUID();
      setPendingRequests(prev => [...prev, {
        participantId,
        type: "microphone",
        requestId,
        status: "pending"
      }]);

      setActiveMenu(null);
    } catch (error) {
      console.error("Failed to request microphone:", error);
    }
  };

  const handleForceCameraOff = async (participantId: string) => {
    if (!canModerate || !user?.id) return;
    
    try {
      await forceCameraOff({
        meetingId,
        hostId: user.id,
        participantId,
        reason: "Host has turned off your camera",
      });
      setActiveMenu(null);
    } catch (error) {
      console.error("Failed to force camera off:", error);
    }
  };

  const handleForceMute = async (participantId: string) => {
    if (!canModerate || !user?.id) return;
    
    try {
      await forceMute({
        meetingId,
        hostId: user.id,
        participantId,
        reason: "Host has muted you",
      });
      setActiveMenu(null);
    } catch (error) {
      console.error("Failed to force mute:", error);
    }
  };

  const handleRemoveParticipant = async (participantId: string) => {
    if (!canModerate || !user?.id) return;
    
    if (!confirm("Are you sure you want to remove this participant from the meeting?")) {
      return;
    }
    
    try {
      await removeParticipant({
        meetingId,
        hostId: user.id,
        participantId,
        reason: "Removed by host",
      });
      setActiveMenu(null);
      onParticipantRemove?.(participantId);
    } catch (error) {
      console.error("Failed to remove participant:", error);
    }
  };

  const getRequestStatus = (participantId: string, type: "camera" | "microphone") => {
    return pendingRequests.find(req => 
      req.participantId === participantId && req.type === type
    );
  };

  const getParticipantStatus = (participant: MeetingParticipant) => {
    const cameraRequest = getRequestStatus(participant.user_id, "camera");
    const micRequest = getRequestStatus(participant.user_id, "microphone");

    return {
      cameraRequested: cameraRequest?.status === "pending",
      cameraAccepted: cameraRequest?.status === "accepted",
      cameraDeclined: cameraRequest?.status === "declined",
      micRequested: micRequest?.status === "pending",
      micAccepted: micRequest?.status === "accepted",
      micDeclined: micRequest?.status === "declined",
    };
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-3 py-2">
        <h3 className="text-sm font-semibold text-white">Participants ({participants.length})</h3>
      </div>
      
      <div className="max-h-64 overflow-y-auto space-y-1">
        {participants.map((participant) => {
          const isCurrentUser = participant.user_id === user?.id;
          const status = getParticipantStatus(participant);
          const showMenu = activeMenu === participant.user_id;

          return (
            <div
              key={participant.user_id}
              className="group relative rounded-xl border border-white/10 bg-black/30 px-3 py-2 transition-colors hover:bg-black/50"
            >
              <div className="flex items-center justify-between">
                <div className="flex min-w-0 items-center gap-2">
                  <UserAvatar
                    person={participant.profile}
                    size="md"
                    className="bg-orange-500/20 text-orange-400"
                  />
                  
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-white">
                        {participant.profile?.full_name || "Unknown User"}
                      </p>
                      {participant.role === "host" && (
                        <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-orange-300">
                          Host
                        </span>
                      )}
                      {isCurrentUser && (
                        <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-300">
                          You
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3 text-xs text-white/60">
                      <div className="flex items-center gap-1">
                        {participant.is_camera_on ? (
                          <Camera size={12} className="text-green-400" />
                        ) : (
                          <CameraOff size={12} className="text-white/40" />
                        )}
                        {status.cameraRequested && (
                          <span className="text-yellow-400">Requested</span>
                        )}
                        {status.cameraAccepted && (
                          <span className="text-green-400">Accepted</span>
                        )}
                        {status.cameraDeclined && (
                          <span className="text-red-400">Declined</span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1">
                        {!participant.is_muted ? (
                          <Mic size={12} className="text-green-400" />
                        ) : (
                          <MicOff size={12} className="text-white/40" />
                        )}
                        {status.micRequested && (
                          <span className="text-yellow-400">Requested</span>
                        )}
                        {status.micAccepted && (
                          <span className="text-green-400">Accepted</span>
                        )}
                        {status.micDeclined && (
                          <span className="text-red-400">Declined</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {canModerate && !isCurrentUser && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setActiveMenu(showMenu ? null : participant.user_id)}
                      className="rounded-lg p-1 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      {showMenu ? <X size={16} /> : <MoreVertical size={16} />}
                    </button>

                    {showMenu && (
                      <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-xl border border-white/10 bg-black/95 shadow-xl">
                        <div className="p-1">
                          {/* Camera Controls */}
                          <div className="px-2 py-1.5 text-xs font-semibold text-white/60 uppercase tracking-wider">
                            Camera
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRequestCamera(participant.user_id)}
                            className="w-full rounded-lg px-3 py-2 text-left text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                          >
                            <div className="flex items-center gap-2">
                              <Camera size={14} />
                              <span>Request Camera On</span>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleForceCameraOff(participant.user_id)}
                            className="w-full rounded-lg px-3 py-2 text-left text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                          >
                            <div className="flex items-center gap-2">
                              <CameraOff size={14} />
                              <span>Turn Camera Off</span>
                            </div>
                          </button>

                          {/* Microphone Controls */}
                          <div className="mt-2 px-2 py-1.5 text-xs font-semibold text-white/60 uppercase tracking-wider">
                            Microphone
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRequestMicrophone(participant.user_id)}
                            className="w-full rounded-lg px-3 py-2 text-left text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                          >
                            <div className="flex items-center gap-2">
                              <Mic size={14} />
                              <span>Request Microphone On</span>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleForceMute(participant.user_id)}
                            className="w-full rounded-lg px-3 py-2 text-left text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                          >
                            <div className="flex items-center gap-2">
                              <MicOff size={14} />
                              <span>Mute Participant</span>
                            </div>
                          </button>

                          {/* Remove Participant */}
                          <div className="mt-2 border-t border-white/10">
                            <button
                              type="button"
                              onClick={() => handleRemoveParticipant(participant.user_id)}
                              className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-400 transition-colors hover:bg-red-500/10"
                            >
                              <div className="flex items-center gap-2">
                                <UserMinus size={14} />
                                <span>Remove Participant</span>
                              </div>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
