import type { ReactNode } from "react";
import {
  Loader2,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  Video,
  VideoOff,
} from "lucide-react";
import { useState } from "react";
import { useLocalParticipant, useRoomContext } from "@livekit/components-react";
import { updateMeetingMediaState } from "../services/meetingService";

type BusyState = "" | "mic" | "camera" | "screen" | "leave" | "end";

function ControlIcon({
  busy,
  busyKey,
  children,
}: {
  busy: BusyState;
  busyKey: BusyState;
  children: ReactNode;
}) {
  if (busy === busyKey) {
    return <Loader2 size={17} className="animate-spin" />;
  }

  return children;
}

export default function LivekitMeetingControls({
  meetingId,
  userId,
  onLeave,
  onEndMeeting,
  isHost,
}: {
  meetingId: string;
  userId: string;
  onLeave: () => Promise<void> | void;
  onEndMeeting?: () => Promise<void> | void;
  isHost: boolean;
}) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const [busy, setBusy] = useState<BusyState>("");

  const isMuted = !localParticipant.isMicrophoneEnabled;
  const isCameraOn = localParticipant.isCameraEnabled;
  const isScreenSharing = localParticipant.isScreenShareEnabled;

  async function toggleMic() {
    try {
      setBusy("mic");

      const nextMicEnabled = !localParticipant.isMicrophoneEnabled;
      await localParticipant.setMicrophoneEnabled(nextMicEnabled);

      await updateMeetingMediaState({
        meetingId,
        userId,
        isMuted: !nextMicEnabled,
      });
    } catch (error) {
      console.error("TOGGLE MIC ERROR:", error);
    } finally {
      setBusy("");
    }
  }

  async function toggleCamera() {
    try {
      setBusy("camera");

      const nextCameraEnabled = !localParticipant.isCameraEnabled;
      await localParticipant.setCameraEnabled(nextCameraEnabled);

      await updateMeetingMediaState({
        meetingId,
        userId,
        isCameraOn: nextCameraEnabled,
      });
    } catch (error) {
      console.error("TOGGLE CAMERA ERROR:", error);
    } finally {
      setBusy("");
    }
  }

  async function toggleScreenShare() {
    try {
      setBusy("screen");

      await localParticipant.setScreenShareEnabled(
        !localParticipant.isScreenShareEnabled,
      );
    } catch (error) {
      console.error("TOGGLE SCREEN SHARE ERROR:", error);
    } finally {
      setBusy("");
    }
  }

  async function handleLeave() {
    try {
      setBusy("leave");
      await room.disconnect();
      await onLeave();
    } finally {
      setBusy("");
    }
  }

  async function handleEndMeeting() {
    try {
      setBusy("end");
      await room.disconnect();
      await onEndMeeting?.();
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="sticky bottom-4 z-30 mx-auto w-full max-w-4xl rounded-3xl border border-white/10 bg-black/80 p-3 shadow-2xl shadow-black/50 backdrop-blur-xl sm:p-4">
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => void toggleMic()}
          disabled={Boolean(busy)}
          className={[
            "inline-flex min-w-28 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
            isMuted
              ? "bg-red-500 text-white hover:bg-red-400"
              : "border border-white/10 bg-neutral-950 text-white hover:border-orange-500/30 hover:bg-orange-500/10",
          ].join(" ")}
        >
          <ControlIcon busy={busy} busyKey="mic">
            {isMuted ? <MicOff size={17} /> : <Mic size={17} />}
          </ControlIcon>
          {isMuted ? "Unmute" : "Mute"}
        </button>

        <button
          type="button"
          onClick={() => void toggleCamera()}
          disabled={Boolean(busy)}
          className={[
            "inline-flex min-w-32 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
            !isCameraOn
              ? "bg-red-500 text-white hover:bg-red-400"
              : "border border-white/10 bg-neutral-950 text-white hover:border-orange-500/30 hover:bg-orange-500/10",
          ].join(" ")}
        >
          <ControlIcon busy={busy} busyKey="camera">
            {isCameraOn ? <Video size={17} /> : <VideoOff size={17} />}
          </ControlIcon>
          {isCameraOn ? "Camera" : "Start cam"}
        </button>

        <button
          type="button"
          onClick={() => void toggleScreenShare()}
          disabled={Boolean(busy)}
          className={[
            "inline-flex min-w-36 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
            isScreenSharing
              ? "bg-orange-500 text-black hover:bg-orange-400"
              : "border border-white/10 bg-neutral-950 text-white hover:border-orange-500/30 hover:bg-orange-500/10",
          ].join(" ")}
        >
          <ControlIcon busy={busy} busyKey="screen">
            <MonitorUp size={17} />
          </ControlIcon>
          {isScreenSharing ? "Stop share" : "Share"}
        </button>

        {isHost ? (
          <button
            type="button"
            onClick={() => void handleEndMeeting()}
            disabled={Boolean(busy)}
            className="inline-flex min-w-32 items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ControlIcon busy={busy} busyKey="end">
              <PhoneOff size={17} />
            </ControlIcon>
            End
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => void handleLeave()}
          disabled={Boolean(busy)}
          className="inline-flex min-w-28 items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300 transition hover:bg-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ControlIcon busy={busy} busyKey="leave">
            <PhoneOff size={17} />
          </ControlIcon>
          Leave
        </button>
      </div>
    </div>
  );
}
