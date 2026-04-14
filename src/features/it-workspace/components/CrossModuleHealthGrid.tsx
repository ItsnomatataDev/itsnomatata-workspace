import { Link } from "react-router-dom";
import { CheckCircle2, AlertTriangle, XCircle, HelpCircle } from "lucide-react";
import type {
  ModuleHealthItem,
  ModuleSignal,
} from "../services/controlCentreService";

const signalConfig: Record<
  ModuleSignal,
  { icon: typeof CheckCircle2; color: string; bg: string; border: string }
> = {
  green: {
    icon: CheckCircle2,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
  },
  amber: {
    icon: AlertTriangle,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
  },
  red: {
    icon: XCircle,
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
  },
  grey: {
    icon: HelpCircle,
    color: "text-white/40",
    bg: "bg-white/5",
    border: "border-white/10",
  },
};

type Props = {
  modules: ModuleHealthItem[];
  loading?: boolean;
};

export default function CrossModuleHealthGrid({ modules, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-2xl border border-white/10 bg-white/5 p-4"
          >
            <div className="h-4 w-16 rounded bg-white/10" />
            <div className="mt-3 h-3 w-24 rounded bg-white/10" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
      {modules.map((mod) => {
        const cfg = signalConfig[mod.signal];
        const Icon = cfg.icon;

        return (
          <Link
            key={mod.module}
            to={mod.route}
            className={`group rounded-2xl border ${cfg.border} ${cfg.bg} p-4 transition-all hover:scale-[1.02] hover:border-orange-500/30`}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-white/80">{mod.module}</p>
              <Icon size={16} className={cfg.color} />
            </div>
            <p className={`mt-2 text-xs font-medium ${cfg.color}`}>
              {mod.label}
            </p>
            {mod.detail && (
              <p className="mt-1 text-[11px] text-white/40">{mod.detail}</p>
            )}
          </Link>
        );
      })}
    </div>
  );
}
