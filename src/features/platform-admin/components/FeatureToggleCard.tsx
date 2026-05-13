import type { OrganizationFeature } from "../types/platformAdmin";

export default function FeatureToggleCard({
  feature,
  locked,
  busy,
  onToggle,
}: {
  feature: OrganizationFeature;
  locked?: boolean;
  busy?: boolean;
  onToggle?: (feature: OrganizationFeature) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#181818] px-3 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-white/85">
          {feature.module_label ?? feature.feature_key}
        </p>
        <p className="text-xs text-white/40">
          {feature.module_category ?? feature.feature_key}
        </p>
      </div>

      <button
        type="button"
        disabled={busy || locked}
        onClick={() => onToggle?.(feature)}
        className={[
          "shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40",
          feature.enabled
            ? "bg-orange-500 text-black"
            : "bg-white/10 text-white/55 hover:bg-white/15",
        ].join(" ")}
      >
        {locked ? "Locked" : busy ? "Saving" : feature.enabled ? "On" : "Off"}
      </button>
    </div>
  );
}
