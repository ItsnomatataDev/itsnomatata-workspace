import {
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  Video,
  VideoOff,
} from "lucide-react";
import { useState } from "react";
import { useLocalParticipant, useRoomContext } from "@livekit/components-react";

export default function LivekitMeetingControls({
  onLeave,
  onEndMeeting,
  isHost,
}: {
  onLeave: () => Promise<void> | void;
  onEndMeeting?: () => Promise<void> | void;
  isHost: boolean;
}) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();

  const [busy, setBusy] = useState<"" | "mic" | "camera" | "screen">("");

  const isMuted = !localParticipant.isMicrophoneEnabled;
  const isCameraOn = localParticipant.isCameraEnabled;
  const isScreenSharing = localParticipant.isScreenShareEnabled;

  async function toggleMic() {
    try {
      setBusy("mic");
      await localParticipant.setMicrophoneEnabled(
        !localParticipant.isMicrophoneEnabled,
      );
    } finally {
      setBusy("");
    }
  }

  async function toggleCamera() {
    try {
      setBusy("camera");
      await localParticipant.setCameraEnabled(
        !localParticipant.isCameraEnabled,
      );
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
    } finally {
      setBusy("");
    }
  }

  async function handleLeave() {
    await room.disconnect();
    await onLeave();
  }

  async function handleEndMeeting() {
    await room.disconnect();
    await onEndMeeting?.();
  }

  return (
    <div className="border border-white/10 bg-black p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <button
          type="button"
          onClick={() => void toggleMic()}
          disabled={busy === "mic"}
          className={[
            "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition",
            isMuted
              ? "bg-red-500 text-white hover:bg-red-400"
              : "border border-white/10 bg-neutral-950 text-white hover:border-orange-500/30 hover:bg-orange-500/5",
          ].join(" ")}
        >
          {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
          {isMuted ? "Unmute" : "Mute"}
        </button>

        <button
          type="button"
          onClick={() => void toggleCamera()}
          disabled={busy === "camera"}
          className={[
            "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition",
            !isCameraOn
              ? "bg-red-500 text-white hover:bg-red-400"
              : "border border-white/10 bg-neutral-950 text-white hover:border-orange-500/30 hover:bg-orange-500/5",
          ].join(" ")}
        >
          {isCameraOn ? <Video size={16} /> : <VideoOff size={16} />}
          {isCameraOn ? "Stop camera" : "Start camera"}
        </button>

        <button
          type="button"
          onClick={() => void toggleScreenShare()}
          disabled={busy === "screen"}
          className={[
            "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition",
            isScreenSharing
              ? "bg-orange-500 text-black hover:bg-orange-400"
              : "border border-white/10 bg-neutral-950 text-white hover:border-orange-500/30 hover:bg-orange-500/5",
          ].join(" ")}
        >
          <MonitorUp size={16} />
          {isScreenSharing ? "Stop share" : "Share screen"}
        </button>

        {isHost ? (
          <button
            type="button"
            onClick={() => void handleEndMeeting()}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-400"
          >
            <PhoneOff size={16} />
            End meeting
          </button>
        ) : (
          <div />
        )}

        <button
          type="button"
          onClick={() => void handleLeave()}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-400"
        >
          <PhoneOff size={16} />
          Leave
        </button>
      </div>
    </div>
  );
}
