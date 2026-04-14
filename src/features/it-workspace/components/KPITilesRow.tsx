import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { KPITile } from "../services/controlCentreService";

const trendConfig = {
  up: { icon: TrendingUp, color: "text-emerald-400" },
  down: { icon: TrendingDown, color: "text-red-400" },
  flat: { icon: Minus, color: "text-amber-400" },
};

type Props = {
  kpis: KPITile[];
  loading?: boolean;
};

export default function KPITilesRow({ kpis, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-2xl border border-white/10 bg-white/5 p-4"
          >
            <div className="h-3 w-16 rounded bg-white/10" />
            <div className="mt-3 h-8 w-12 rounded bg-white/10" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {kpis.map((kpi) => {
        const trend = kpi.trend ? trendConfig[kpi.trend] : null;
        const TrendIcon = trend?.icon;

        return (
          <div
            key={kpi.label}
            className="rounded-2xl border border-white/10 bg-white/5 p-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs text-white/50">{kpi.label}</p>
              {TrendIcon && <TrendIcon size={14} className={trend!.color} />}
            </div>
            <p className="mt-2 text-2xl font-bold text-white">{kpi.value}</p>
            {kpi.detail && (
              <p className="mt-1 text-[11px] text-white/40">{kpi.detail}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
