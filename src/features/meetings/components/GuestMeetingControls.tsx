import type { ReactNode } from "react";
import { Loader2, Mic, MicOff, PhoneOff, Settings2, Video, VideoOff } from "lucide-react";
import { useState } from "react";
import { useLocalParticipant, useRoomContext } from "@livekit/components-react";
import MeetingDeviceSettings from "./MeetingDeviceSettings";

type BusyState = "" | "mic" | "camera" | "leave";

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

export default function GuestMeetingControls({
  onLeave,
}: {
  onLeave: () => Promise<void> | void;
}) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const [busy, setBusy] = useState<BusyState>("");
  const [deviceSettingsOpen, setDeviceSettingsOpen] = useState(false);

  const isMuted = !localParticipant.isMicrophoneEnabled;
  const isCameraOn = localParticipant.isCameraEnabled;

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
      await localParticipant.setCameraEnabled(!localParticipant.isCameraEnabled);
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

  return (
    <div className="sticky bottom-4 z-30 mx-auto w-full max-w-3xl rounded-3xl border border-white/10 bg-black/80 p-3 shadow-2xl shadow-black/50 backdrop-blur-xl sm:p-4">
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

        <div className="relative">
          <button
            type="button"
            onClick={() => setDeviceSettingsOpen((current) => !current)}
            disabled={Boolean(busy)}
            aria-haspopup="dialog"
            aria-expanded={deviceSettingsOpen}
            className="inline-flex min-w-28 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-sm font-semibold text-white transition hover:border-orange-500/30 hover:bg-orange-500/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Settings2 size={17} />
            Devices
          </button>

          <MeetingDeviceSettings
            open={deviceSettingsOpen}
            onClose={() => setDeviceSettingsOpen(false)}
          />
        </div>

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
