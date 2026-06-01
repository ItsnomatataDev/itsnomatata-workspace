import { useEffect, useState } from "react";
import { Volume2 } from "lucide-react";
import {
  DEFAULT_SOUND_PREFERENCES,
  loadSoundPreferences,
  saveSoundPreferences,
  type SoundPreferences,
} from "../../../lib/sounds/soundPreferences";
import { playSystemSound } from "../../../lib/sounds/systemSounds";

export default function SoundPreferencesPanel() {
  const [prefs, setPrefs] = useState<SoundPreferences>(DEFAULT_SOUND_PREFERENCES);

  useEffect(() => {
    setPrefs(loadSoundPreferences());
  }, []);

  function update<K extends keyof SoundPreferences>(key: K, value: SoundPreferences[K]) {
    setPrefs((current) => {
      const next = { ...current, [key]: value };
      saveSoundPreferences(next);
      return next;
    });
  }

  return (
    <section className="mt-6 border border-white/10 bg-[#050505] p-5">
      <div className="mb-5 flex items-center gap-3">
        <div className="border border-orange-500/20 bg-orange-500/10 p-2 text-orange-400">
          <Volume2 size={18} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Sounds</h2>
          <p className="text-sm text-white/45">
            Default tones for messages and alerts. Stored on this device.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <ToggleRow
          label="Enable sounds"
          description="Master switch for in-app audio feedback."
          checked={prefs.masterEnabled}
          onChange={(checked) => update("masterEnabled", checked)}
        />

        <label className="block">
          <span className="text-sm font-semibold text-white">Volume</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={prefs.volume}
            disabled={!prefs.masterEnabled}
            onChange={(event) => update("volume", Number(event.target.value))}
            className="mt-2 w-full accent-orange-500"
          />
        </label>

        <ToggleRow
          label="Chat message sound"
          description="Soft ping when a new message arrives while you are elsewhere in the app."
          checked={prefs.messageSounds}
          onChange={(checked) => update("messageSounds", checked)}
          disabled={!prefs.masterEnabled}
        />

        <ToggleRow
          label="Notification sound"
          description="Two-tone chime for tasks, approvals, and general alerts."
          checked={prefs.notificationSounds}
          onChange={(checked) => update("notificationSounds", checked)}
          disabled={!prefs.masterEnabled}
        />

        <div className="flex flex-wrap gap-2 border border-white/10 bg-black/40 p-4">
          <PreviewButton
            label="Preview message"
            disabled={!prefs.masterEnabled}
            onClick={() => void playSystemSound("message")}
          />
          <PreviewButton
            label="Preview notification"
            disabled={!prefs.masterEnabled}
            onClick={() => void playSystemSound("notification")}
          />
        </div>
      </div>
    </section>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 border border-white/10 bg-black/40 p-4">
      <span>
        <span className="block text-sm font-semibold text-white">{label}</span>
        <span className="mt-1 block text-sm text-white/45">{description}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 accent-orange-500"
      />
    </label>
  );
}

function PreviewButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center gap-2 border border-white/10 px-3 py-2 text-xs font-semibold text-white/80 hover:border-orange-400/40 hover:text-orange-200 disabled:opacity-50"
    >
      {label}
    </button>
  );
}
