import {
  loadSoundPreferences,
  shouldPlaySound,
  type SystemSoundKind,
} from "./soundPreferences";

let audioContext: AudioContext | null = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  if (!audioContext) {
    const Ctx =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return null;
    audioContext = new Ctx();
  }
  return audioContext;
}

async function ensureAudioReady() {
  const ctx = getAudioContext();
  if (!ctx) return null;
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      return null;
    }
  }
  return ctx;
}

function scheduleTone(params: {
  frequency: number;
  startAt: number;
  duration: number;
  volume: number;
  type?: OscillatorType;
}) {
  const ctx = getAudioContext();
  if (!ctx) return null;

  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = params.type ?? "sine";
  oscillator.frequency.setValueAtTime(params.frequency, params.startAt);
  gain.gain.setValueAtTime(0.0001, params.startAt);
  gain.gain.exponentialRampToValueAtTime(params.volume, params.startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    params.startAt + params.duration,
  );
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(params.startAt);
  oscillator.stop(params.startAt + params.duration + 0.05);
  return { oscillators: [oscillator], gains: [gain] };
}

/** Short two-tone chime — default in-app / toast notification. */
function playNotificationChime(volume: number) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  scheduleTone({ frequency: 880, startAt: now, duration: 0.12, volume });
  scheduleTone({
    frequency: 1174.66,
    startAt: now + 0.1,
    duration: 0.16,
    volume: volume * 0.9,
  });
}

/** Softer ping — default new chat message. */
function playMessagePing(volume: number) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  scheduleTone({
    frequency: 740,
    startAt: now,
    duration: 0.08,
    volume: volume * 0.85,
    type: "triangle",
  });
  scheduleTone({
    frequency: 988,
    startAt: now + 0.07,
    duration: 0.1,
    volume: volume * 0.7,
    type: "triangle",
  });
}

export async function playSystemSound(kind: SystemSoundKind) {
  if (!shouldPlaySound(kind)) return;
  const ctx = await ensureAudioReady();
  if (!ctx) return;

  const volume = Math.min(1, Math.max(0.08, loadSoundPreferences().volume));

  if (kind === "message") {
    playMessagePing(volume);
    return;
  }
  playNotificationChime(volume);
}

export function resolveSoundKindFromNotification(params: {
  type?: string | null;
  metadata?: Record<string, unknown> | null;
}): SystemSoundKind {
  if (params.type === "chat_message") return "message";
  const metaType = params.metadata?.type;
  if (metaType === "chat_message") return "message";
  return "notification";
}
