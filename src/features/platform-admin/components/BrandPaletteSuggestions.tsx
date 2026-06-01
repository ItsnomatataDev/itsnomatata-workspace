import { useState } from "react";
import {
  ITSNOMATATA_PALETTE_PRESET,
  SUGGESTED_COLOR_TARGETS,
  SUGGESTED_ORGANIZATION_COLORS,
  type BrandingColorValues,
  type SuggestedColorTarget,
} from "../constants/brandColorPresets";

type BrandPaletteSuggestionsProps = {
  onApplyPreset: (values: BrandingColorValues) => void;
  onApplySuggestedColor: (hex: string, target: SuggestedColorTarget) => void;
  compact?: boolean;
};

export default function BrandPaletteSuggestions({
  onApplyPreset,
  onApplySuggestedColor,
  compact = false,
}: BrandPaletteSuggestionsProps) {
  const [colorTarget, setColorTarget] =
    useState<SuggestedColorTarget>("accent_color");

  return (
    <div
      className={[
        "rounded-2xl border border-white/10 bg-black/40",
        compact ? "p-3" : "p-4",
      ].join(" ")}
    >
      <div>
        <h4 className="text-sm font-semibold text-white">
          Suggested brand colors
        </h4>
        <p className="mt-1 text-xs text-white/45">
          Palette swatches you can recommend when onboarding other organizations.
          Pick a slot, then click a color to apply it.
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTED_COLOR_TARGETS.map((target) => (
          <button
            key={target.key}
            type="button"
            onClick={() => setColorTarget(target.key)}
            className={[
              "rounded-full border px-3 py-1 text-xs font-semibold transition",
              colorTarget === target.key
                ? "border-orange-500/40 bg-orange-500/15 text-orange-200"
                : "border-white/10 bg-white/5 text-white/55 hover:bg-white/10 hover:text-white/80",
            ].join(" ")}
          >
            {target.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-3">
        {SUGGESTED_ORGANIZATION_COLORS.map((color) => (
          <button
            key={color.hex}
            type="button"
            title={`${color.label} (${color.hex}) → ${colorTarget}`}
            onClick={() => onApplySuggestedColor(color.hex, colorTarget)}
            className="group flex flex-col items-center gap-1.5"
          >
            <span
              className="block h-11 w-11 rounded-2xl border-2 border-white/15 shadow-inner transition group-hover:scale-105 group-hover:border-orange-400/50"
              style={{ backgroundColor: color.hex }}
            />
            <span className="max-w-18 truncate text-[10px] font-medium text-white/55 group-hover:text-white/80">
              {color.label}
            </span>
            <span className="font-mono text-[10px] text-white/35">{color.hex}</span>
          </button>
        ))}
      </div>

      <div className="mt-5 border-t border-white/10 pt-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">
              {ITSNOMATATA_PALETTE_PRESET.label}
            </p>
            <p className="mt-1 text-xs text-white/45">
              {ITSNOMATATA_PALETTE_PRESET.description}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onApplyPreset(ITSNOMATATA_PALETTE_PRESET.values)}
            className="shrink-0 rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-2 text-xs font-semibold text-orange-200 transition hover:bg-orange-500/20"
          >
            Apply {ITSNOMATATA_PALETTE_PRESET.label} palette
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {SUGGESTED_ORGANIZATION_COLORS.map((color) => (
            <span
              key={`itsnomatata-${color.hex}`}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2 py-1"
            >
              <span
                className="h-5 w-5 rounded-full border border-white/15"
                style={{ backgroundColor: color.hex }}
              />
              <span className="font-mono text-[10px] text-white/50">{color.hex}</span>
            </span>
          ))}
        </div>

        {!compact ? (
          <div className="mt-3 grid gap-2 text-[11px] text-white/40 sm:grid-cols-2">
            <p>Primary / sidebar: #281f55</p>
            <p>Secondary / text: #ccc3bf</p>
            <p>Accent / buttons: #99694d</p>
            <p>Muted text: #7a6d81</p>
            <p>Borders / links: #8c8cac</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
