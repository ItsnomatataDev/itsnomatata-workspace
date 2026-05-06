import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Headphones,
  Loader2,
  Mic,
  MonitorSpeaker,
  RefreshCw,
  Video,
} from "lucide-react";
import { useRoomContext } from "@livekit/components-react";

export const PREFERRED_MIC_ID_KEY = "preferred_mic_id";
export const PREFERRED_CAMERA_ID_KEY = "preferred_camera_id";
export const PREFERRED_SPEAKER_ID_KEY = "preferred_speaker_id";

type BusyDevice = "" | "audioinput" | "videoinput" | "audiooutput";

type SinkMediaElement = HTMLMediaElement & {
  setSinkId?: (sinkId: string) => Promise<void>;
  sinkId?: string;
};

type DeviceOption = {
  deviceId: string;
  groupId: string;
  kind: MediaDeviceKind;
  label: string;
};

type MeetingDeviceSettingsProps = {
  open: boolean;
  onClose: () => void;
  mediaRootSelector?: string;
};

function getStoredDeviceId(key: string) {
  if (typeof window === "undefined") return "default";
  return window.localStorage.getItem(key) || "default";
}

function storeDeviceId(key: string, deviceId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, deviceId);
}

function getDeviceLabel(device: MediaDeviceInfo, fallback: string, index: number) {
  return device.label || `${fallback} ${index + 1}`;
}

function supportsSetSinkId() {
  if (typeof HTMLMediaElement === "undefined") return false;
  return "setSinkId" in HTMLMediaElement.prototype;
}

async function applySinkIdToMediaElements(
  sinkId: string,
  mediaRootSelector: string,
) {
  if (!supportsSetSinkId()) {
    return { applied: 0, unsupported: true };
  }

  const root =
    document.querySelector(mediaRootSelector) ??
    document.querySelector("[data-meeting-media-root='true']") ??
    document;

  const elements = Array.from(
    root.querySelectorAll<HTMLMediaElement>("audio, video"),
  );

  let applied = 0;
  await Promise.all(
    elements.map(async (element) => {
      const sinkElement = element as SinkMediaElement;
      if (!sinkElement.setSinkId) return;

      await sinkElement.setSinkId(sinkId);
      applied += 1;
    }),
  );

  return { applied, unsupported: false };
}

function normalizeDevices(devices: MediaDeviceInfo[]) {
  const counters: Record<MediaDeviceKind, number> = {
    audioinput: 0,
    audiooutput: 0,
    videoinput: 0,
  };

  return devices.map((device) => {
    const index = counters[device.kind] ?? 0;
    counters[device.kind] = index + 1;

    const fallback =
      device.kind === "audioinput"
        ? "Microphone"
        : device.kind === "videoinput"
          ? "Camera"
          : "Speaker";

    return {
      deviceId: device.deviceId,
      groupId: device.groupId,
      kind: device.kind,
      label: getDeviceLabel(device, fallback, index),
    };
  });
}

function DeviceSelect({
  id,
  label,
  icon,
  devices,
  value,
  disabled,
  unsupportedMessage,
  onChange,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  devices: DeviceOption[];
  value: string;
  disabled?: boolean;
  unsupportedMessage?: string;
  onChange: (deviceId: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="flex items-center justify-between gap-3 text-sm font-semibold text-white"
      >
        <span className="inline-flex items-center gap-2">
          {icon}
          {label}
        </span>
        {value && value !== "default" ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-orange-500/20 bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-orange-300">
            <CheckCircle2 size={11} />
            Active
          </span>
        ) : null}
      </label>

      <div className="relative">
        <select
          id={id}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="w-full appearance-none rounded-2xl border border-white/10 bg-black px-3 py-3 pr-10 text-sm text-white outline-none transition disabled:cursor-not-allowed disabled:opacity-50 focus:border-orange-500/50"
        >
          <option value="default">System default</option>
          {devices.map((device) => (
            <option key={`${device.kind}:${device.deviceId}`} value={device.deviceId}>
              {device.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/40"
        />
      </div>

      {unsupportedMessage ? (
        <p className="text-xs leading-relaxed text-white/40">
          {unsupportedMessage}
        </p>
      ) : null}
    </div>
  );
}

export default function MeetingDeviceSettings({
  open,
  onClose,
  mediaRootSelector = "[data-meeting-media-root='true']",
}: MeetingDeviceSettingsProps) {
  const room = useRoomContext();
  const [devices, setDevices] = useState<DeviceOption[]>([]);
  const [selectedMicId, setSelectedMicId] = useState(() =>
    getStoredDeviceId(PREFERRED_MIC_ID_KEY),
  );
  const [selectedCameraId, setSelectedCameraId] = useState(() =>
    getStoredDeviceId(PREFERRED_CAMERA_ID_KEY),
  );
  const [selectedSpeakerId, setSelectedSpeakerId] = useState(() =>
    getStoredDeviceId(PREFERRED_SPEAKER_ID_KEY),
  );
  const [busy, setBusy] = useState<BusyDevice>("");
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [message, setMessage] = useState("");
  const restoredRef = useRef(false);
  const speakerSinkSupported = useMemo(() => supportsSetSinkId(), []);

  const microphones = useMemo(
    () => devices.filter((device) => device.kind === "audioinput"),
    [devices],
  );
  const cameras = useMemo(
    () => devices.filter((device) => device.kind === "videoinput"),
    [devices],
  );
  const speakers = useMemo(
    () => devices.filter((device) => device.kind === "audiooutput"),
    [devices],
  );

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setMessage("Media device selection is not available in this browser.");
      setLoadingDevices(false);
      return;
    }

    try {
      setLoadingDevices(true);
      const nextDevices = await navigator.mediaDevices.enumerateDevices();
      setDevices(
        normalizeDevices(
          nextDevices.filter((device) =>
            ["audioinput", "videoinput", "audiooutput"].includes(device.kind),
          ),
        ),
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not refresh media devices.",
      );
    } finally {
      setLoadingDevices(false);
    }
  }, []);

  const switchDevice = useCallback(
    async (kind: MediaDeviceKind, deviceId: string, silent = false) => {
      try {
        setBusy(kind);
        if (!silent) setMessage("");

        await room.switchActiveDevice(kind, deviceId, false);

        if (kind === "audioinput") {
          setSelectedMicId(deviceId);
          storeDeviceId(PREFERRED_MIC_ID_KEY, deviceId);
        }

        if (kind === "videoinput") {
          setSelectedCameraId(deviceId);
          storeDeviceId(PREFERRED_CAMERA_ID_KEY, deviceId);
        }

        if (kind === "audiooutput") {
          setSelectedSpeakerId(deviceId);
          storeDeviceId(PREFERRED_SPEAKER_ID_KEY, deviceId);
          await applySinkIdToMediaElements(deviceId, mediaRootSelector);
        }
      } catch (error) {
        const fallback =
          kind === "audioinput"
            ? "Could not switch microphone."
            : kind === "videoinput"
              ? "Could not switch camera."
              : "Could not switch speaker.";

        setMessage(error instanceof Error ? error.message : fallback);
      } finally {
        setBusy("");
      }
    },
    [mediaRootSelector, room],
  );

  const switchSpeaker = useCallback(
    async (deviceId: string, silent = false) => {
      if (!speakerSinkSupported) {
        setMessage(
          "Speaker selection is not supported in this browser. Your system output will be used.",
        );
        return;
      }

      await switchDevice("audiooutput", deviceId, silent);
    },
    [speakerSinkSupported, switchDevice],
  );

  useEffect(() => {
    void refreshDevices();
  }, [refreshDevices]);

  useEffect(() => {
    if (!navigator.mediaDevices?.addEventListener) return;

    const handleDeviceChange = () => {
      void refreshDevices();
    };

    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);

    return () => {
      navigator.mediaDevices.removeEventListener(
        "devicechange",
        handleDeviceChange,
      );
    };
  }, [refreshDevices]);

  useEffect(() => {
    if (restoredRef.current || loadingDevices) return;
    restoredRef.current = true;

    const storedMicId = getStoredDeviceId(PREFERRED_MIC_ID_KEY);
    const storedCameraId = getStoredDeviceId(PREFERRED_CAMERA_ID_KEY);
    const storedSpeakerId = getStoredDeviceId(PREFERRED_SPEAKER_ID_KEY);

    if (storedMicId) {
      void switchDevice("audioinput", storedMicId, true);
    }

    if (storedCameraId) {
      void switchDevice("videoinput", storedCameraId, true);
    }

    if (storedSpeakerId && speakerSinkSupported) {
      void switchSpeaker(storedSpeakerId, true);
    }
  }, [loadingDevices, speakerSinkSupported, switchDevice, switchSpeaker]);

  useEffect(() => {
    if (loadingDevices || devices.length === 0) return;

    const hasDevice = (kind: MediaDeviceKind, deviceId: string) =>
      deviceId === "default" ||
      devices.some(
        (device) => device.kind === kind && device.deviceId === deviceId,
      );

    if (!hasDevice("audioinput", selectedMicId)) {
      setMessage("Your selected microphone disconnected. Using system default.");
      void switchDevice("audioinput", "default", true);
    }

    if (!hasDevice("videoinput", selectedCameraId)) {
      setMessage("Your selected camera disconnected. Using system default.");
      void switchDevice("videoinput", "default", true);
    }

    if (speakerSinkSupported && !hasDevice("audiooutput", selectedSpeakerId)) {
      setMessage("Your selected speaker disconnected. Using system default.");
      void switchSpeaker("default", true);
    }
  }, [
    devices,
    loadingDevices,
    selectedCameraId,
    selectedMicId,
    selectedSpeakerId,
    speakerSinkSupported,
    switchDevice,
    switchSpeaker,
  ]);

  useEffect(() => {
    if (!speakerSinkSupported) return;

    const root = document.querySelector(mediaRootSelector);
    if (!root) return;

    void applySinkIdToMediaElements(selectedSpeakerId, mediaRootSelector).catch(
      () => undefined,
    );

    const observer = new MutationObserver(() => {
      void applySinkIdToMediaElements(selectedSpeakerId, mediaRootSelector).catch(
        () => undefined,
      );
    });

    observer.observe(root, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [mediaRootSelector, selectedSpeakerId, speakerSinkSupported]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Meeting device settings"
      className="absolute bottom-full left-1/2 z-40 mb-3 w-[min(92vw,28rem)] -translate-x-1/2 rounded-3xl border border-white/10 bg-neutral-950 p-4 text-left shadow-2xl shadow-black/70"
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-400">
            Devices
          </p>
          <h2 className="mt-1 text-base font-semibold text-white">
            Audio and video settings
          </h2>
        </div>

        <button
          type="button"
          onClick={() => void refreshDevices()}
          disabled={loadingDevices || Boolean(busy)}
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black px-3 py-2 text-xs font-semibold text-white/70 transition hover:border-orange-500/30 hover:text-orange-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loadingDevices ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <RefreshCw size={14} />
          )}
          Refresh
        </button>
      </div>

      <div className="space-y-4">
        <DeviceSelect
          id="meeting-microphone-select"
          label="Microphone"
          icon={<Mic size={16} className="text-orange-400" />}
          devices={microphones}
          value={selectedMicId}
          disabled={loadingDevices || Boolean(busy)}
          onChange={(deviceId) => void switchDevice("audioinput", deviceId)}
        />

        <DeviceSelect
          id="meeting-camera-select"
          label="Camera"
          icon={<Video size={16} className="text-orange-400" />}
          devices={cameras}
          value={selectedCameraId}
          disabled={loadingDevices || Boolean(busy)}
          onChange={(deviceId) => void switchDevice("videoinput", deviceId)}
        />

        <DeviceSelect
          id="meeting-speaker-select"
          label="Speaker"
          icon={
            speakerSinkSupported ? (
              <Headphones size={16} className="text-orange-400" />
            ) : (
              <MonitorSpeaker size={16} className="text-white/40" />
            )
          }
          devices={speakers}
          value={selectedSpeakerId}
          disabled={loadingDevices || Boolean(busy) || !speakerSinkSupported}
          unsupportedMessage={
            speakerSinkSupported
              ? undefined
              : "This browser does not support per-meeting speaker selection."
          }
          onChange={(deviceId) => void switchSpeaker(deviceId)}
        />
      </div>

      {busy ? (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-orange-500/20 bg-orange-500/10 px-3 py-2 text-xs text-orange-100">
          <Loader2 size={14} className="animate-spin" />
          Switching device...
        </div>
      ) : null}

      {message ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-black px-3 py-2 text-xs leading-relaxed text-white/65">
          {message}
        </div>
      ) : null}

      <button
        type="button"
        onClick={onClose}
        className="mt-4 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:border-orange-500/30 hover:bg-orange-500/10"
      >
        Done
      </button>
    </div>
  );
}
