import type { ReactNode } from "react";
import {
  Loader2,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  Settings2,
  Video,
  VideoOff,
  Volume2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useLocalParticipant,
  useMediaDeviceSelect,
  useRoomContext,
} from "@livekit/components-react";
import { updateMeetingMediaState } from "../services/meetingService";

type BusyState = "" | "mic" | "camera" | "screen" | "leave" | "end" | "device";

const AUDIO_INPUT_STORAGE_KEY = "meeting_audio_input_device_id";
const AUDIO_OUTPUT_STORAGE_KEY = "meeting_audio_output_device_id";

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
  const [deviceMenuOpen, setDeviceMenuOpen] = useState(false);
  const [deviceError, setDeviceError] = useState("");
  const appliedStoredDevicesRef = useRef(false);
  const supportsAudioOutput = useMemo(() => {
    if (typeof HTMLMediaElement === "undefined") return false;
    return "setSinkId" in HTMLMediaElement.prototype;
  }, []);

  const audioInput = useMediaDeviceSelect({
    kind: "audioinput",
    room,
    requestPermissions: false,
    onError: (error) => setDeviceError(error.message),
  });
  const audioOutput = useMediaDeviceSelect({
    kind: "audiooutput",
    room,
    requestPermissions: false,
    onError: (error) => setDeviceError(error.message),
  });

  const isMuted = !localParticipant.isMicrophoneEnabled;
  const isCameraOn = localParticipant.isCameraEnabled;
  const isScreenSharing = localParticipant.isScreenShareEnabled;

  useEffect(() => {
    if (appliedStoredDevicesRef.current) return;
    appliedStoredDevicesRef.current = true;

    const inputDeviceId = localStorage.getItem(AUDIO_INPUT_STORAGE_KEY);
    const outputDeviceId = localStorage.getItem(AUDIO_OUTPUT_STORAGE_KEY);

    if (inputDeviceId) {
      void audioInput.setActiveMediaDevice(inputDeviceId, { exact: false })
        .catch((error: unknown) => {
          setDeviceError(
            error instanceof Error
              ? error.message
              : "Could not restore microphone device.",
          );
        });
    }

    if (outputDeviceId && supportsAudioOutput) {
      void audioOutput.setActiveMediaDevice(outputDeviceId, { exact: false })
        .catch((error: unknown) => {
          setDeviceError(
            error instanceof Error
              ? error.message
              : "Could not restore speaker device.",
          );
        });
    }
  }, [audioInput, audioOutput, supportsAudioOutput]);

  async function changeAudioInput(deviceId: string) {
    try {
      setBusy("device");
      setDeviceError("");
      await audioInput.setActiveMediaDevice(deviceId, { exact: false });
      localStorage.setItem(AUDIO_INPUT_STORAGE_KEY, deviceId);
    } catch (error) {
      setDeviceError(
        error instanceof Error ? error.message : "Could not switch microphone.",
      );
    } finally {
      setBusy("");
    }
  }

  async function changeAudioOutput(deviceId: string) {
    if (!supportsAudioOutput) {
      setDeviceError("Speaker selection is not supported in this browser.");
      return;
    }

    try {
      setBusy("device");
      setDeviceError("");
      await audioOutput.setActiveMediaDevice(deviceId, { exact: false });
      localStorage.setItem(AUDIO_OUTPUT_STORAGE_KEY, deviceId);
    } catch (error) {
      setDeviceError(
        error instanceof Error ? error.message : "Could not switch speaker.",
      );
    } finally {
      setBusy("");
    }
  }

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

        <div className="relative">
          <button
            type="button"
            onClick={() => setDeviceMenuOpen((current) => !current)}
            disabled={Boolean(busy && busy !== "device")}
            className="inline-flex min-w-28 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-sm font-semibold text-white transition hover:border-orange-500/30 hover:bg-orange-500/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ControlIcon busy={busy} busyKey="device">
              <Settings2 size={17} />
            </ControlIcon>
            Audio
          </button>

          {deviceMenuOpen ? (
            <div className="absolute bottom-full left-1/2 z-40 mb-3 w-80 -translate-x-1/2 rounded-2xl border border-white/10 bg-neutral-950 p-4 text-left shadow-2xl shadow-black/60">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                <Mic size={15} className="text-orange-400" />
                Microphone
              </div>

              <select
                value={audioInput.activeDeviceId ?? "default"}
                disabled={busy === "device"}
                onChange={(event) => void changeAudioInput(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none transition focus:border-orange-500/50"
              >
                <option value="default">Default microphone</option>
                {audioInput.devices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || "Microphone"}
                  </option>
                ))}
              </select>

              <div className="mb-3 mt-4 flex items-center gap-2 text-sm font-semibold text-white">
                <Volume2 size={15} className="text-orange-400" />
                Speaker
              </div>

              <select
                value={audioOutput.activeDeviceId ?? "default"}
                disabled={busy === "device" || !supportsAudioOutput}
                onChange={(event) => void changeAudioOutput(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none transition disabled:opacity-50 focus:border-orange-500/50"
              >
                <option value="default">Default speaker</option>
                {audioOutput.devices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || "Speaker"}
                  </option>
                ))}
              </select>

              {!supportsAudioOutput ? (
                <p className="mt-2 text-xs text-white/40">
                  This browser does not support choosing a speaker output.
                </p>
              ) : null}

              {deviceError ? (
                <p className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  {deviceError}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

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
