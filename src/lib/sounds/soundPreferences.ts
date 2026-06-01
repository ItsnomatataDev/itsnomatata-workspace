export type SystemSoundKind = "notification" | "message";

export type SoundPreferences = {
  masterEnabled: boolean;
  volume: number;
  messageSounds: boolean;
  notificationSounds: boolean;
};

const STORAGE_KEY = "itsnomatata_sound_preferences";

export const DEFAULT_SOUND_PREFERENCES: SoundPreferences = {
  masterEnabled: true,
  volume: 0.72,
  messageSounds: true,
  notificationSounds: true,
};

export function loadSoundPreferences(): SoundPreferences {
  if (typeof window === "undefined") return DEFAULT_SOUND_PREFERENCES;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SOUND_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<SoundPreferences> & {
      callRingtone?: boolean;
    };
    return {
      ...DEFAULT_SOUND_PREFERENCES,
      ...parsed,
      volume: clampVolume(parsed.volume ?? DEFAULT_SOUND_PREFERENCES.volume),
    };
  } catch {
    return DEFAULT_SOUND_PREFERENCES;
  }
}

export function saveSoundPreferences(preferences: SoundPreferences) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...preferences,
      volume: clampVolume(preferences.volume),
    }),
  );
}

function clampVolume(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_SOUND_PREFERENCES.volume;
  return Math.min(1, Math.max(0, value));
}

export function shouldPlaySound(kind: SystemSoundKind) {
  const prefs = loadSoundPreferences();
  if (!prefs.masterEnabled) return false;
  if (kind === "message") return prefs.messageSounds;
  return prefs.notificationSounds;
}
