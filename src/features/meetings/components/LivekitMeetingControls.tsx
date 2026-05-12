import { useState } from "react";
import {
  Crown,
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
  PhoneOff,
  Video,
  VideoOff,
} from "lucide-react";
import {
  useLocalParticipant,
  useMaybeRoomContext,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { updateMeetingMediaState } from "../services/meetingService";

type Props = {
  meetingId: string;
  userId: string;
  isHost: boolean;
  onLeave: () => void | Promise<void>;
  onEndMeeting: () => void | Promise<void>;
};

export default function LivekitMeetingControls({
  meetingId,
  userId,
  isHost,
  onLeave,
  onEndMeeting,
}: Props) {
  const { localParticipant } = useLocalParticipant();
  const room = useMaybeRoomContext();
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const isMuted = localParticipant?.isMicrophoneEnabled === false;
  const isCameraOff = localParticipant?.isCameraEnabled === false;

  async function syncMediaState(input: {
    isMuted?: boolean;
    isCameraOn?: boolean;
  }) {
    try {
      await updateMeetingMediaState({
        meetingId,
        userId,
        ...input,
      });
    } catch (error) {
      console.error("MEDIA STATE SYNC ERROR:", error);
    }
  }

  async function handleToggleMic() {
    if (!localParticipant) return;

    const next = !localParticipant.isMicrophoneEnabled;
    await localParticipant.setMicrophoneEnabled(next);
    void syncMediaState({ isMuted: !next });
  }

  async function handleToggleCamera() {
    if (!localParticipant) return;

    const next = !localParticipant.isCameraEnabled;
    await localParticipant.setCameraEnabled(next);
    void syncMediaState({ isCameraOn: next });
  }

  async function handleToggleScreenShare() {
    if (!localParticipant || !room) return;

    try {
      if (isScreenSharing) {
        await localParticipant.setScreenShareEnabled(false);
        setIsScreenSharing(false);
        return;
      }

      await localParticipant.setScreenShareEnabled(true, {
        resolution: {
          width: 1280,
          height: 720,
          frameRate: 24,
        },
        contentHint: "detail",
      });

      setIsScreenSharing(true);

      const publication = localParticipant.getTrackPublication(
        Track.Source.ScreenShare,
      );

      const mediaTrack = publication?.track?.mediaStreamTrack;

      if (mediaTrack) {
        mediaTrack.addEventListener(
          "ended",
          () => {
            setIsScreenSharing(false);
          },
          { once: true },
        );
      }
    } catch (error) {
      if (error instanceof Error && error.name === "NotAllowedError") return;
      console.error("SCREEN SHARE ERROR:", error);
    }
  }

  async function handleLeave() {
    if (leaving) return;

    try {
      setLeaving(true);
      await onLeave();
    } finally {
      setLeaving(false);
    }
  }

  return (
    <div className="flex items-center justify-center gap-3 py-4">
      <button
        type="button"
        onClick={() => void handleToggleMic()}
        title={isMuted ? "Unmute" : "Mute"}
        className={[
          "flex h-12 w-12 items-center justify-center rounded-full border transition",
          isMuted
            ? "border-red-500/30 bg-red-500/15 text-red-300 hover:bg-red-500/25"
            : "border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:text-white",
        ].join(" ")}
      >
        {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
      </button>

      <button
        type="button"
        onClick={() => void handleToggleCamera()}
        title={isCameraOff ? "Turn camera on" : "Turn camera off"}
        className={[
          "flex h-12 w-12 items-center justify-center rounded-full border transition",
          isCameraOff
            ? "border-red-500/30 bg-red-500/15 text-red-300 hover:bg-red-500/25"
            : "border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:text-white",
        ].join(" ")}
      >
        {isCameraOff ? <VideoOff size={18} /> : <Video size={18} />}
      </button>

      <button
        type="button"
        onClick={() => void handleToggleScreenShare()}
        title={isScreenSharing ? "Stop sharing" : "Share screen"}
        className={[
          "flex h-12 w-12 items-center justify-center rounded-full border transition",
          isScreenSharing
            ? "border-orange-500/40 bg-orange-500/20 text-orange-300 hover:bg-orange-500/30"
            : "border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:text-white",
        ].join(" ")}
      >
        {isScreenSharing ? <MonitorOff size={18} /> : <Monitor size={18} />}
      </button>

      {isHost ? (
        <button
          type="button"
          onClick={() => void onEndMeeting()}
          title="End meeting for everyone"
          className="flex h-12 items-center gap-2 rounded-full border border-red-500/30 bg-red-500/15 px-4 text-sm font-semibold text-red-300 transition hover:bg-red-500/25"
        >
          <Crown size={16} />
          End
        </button>
      ) : null}

      <button
        type="button"
        onClick={() => void handleLeave()}
        disabled={leaving}
        title="Leave meeting"
        className="flex h-12 items-center gap-2 rounded-full bg-red-500 px-5 text-sm font-semibold text-white transition hover:bg-red-400 disabled:opacity-50"
      >
        <PhoneOff size={16} />
        Leave
      </button>
    </div>
  );
}