import { Trash2, Lock, Unlock } from "lucide-react";
import type { LeaveCalendarRuleRow } from "../services/leaveCalendarService";

export default function LeaveRuleList({
  rules,
  onDelete,
  deletingId,
}: {
  rules: LeaveCalendarRuleRow[];
  onDelete: (ruleId: string) => void;
  deletingId?: string | null;
}) {
  if (rules.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/60">
        No leave calendar rules created yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rules.map((rule) => {
        const isClosed = rule.rule_type === "closed";

        return (
          <div
            key={rule.id}
            className="rounded-2xl border border-white/10 bg-white/5 p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
                      isClosed
                        ? "border border-red-500/20 bg-red-500/10 text-red-300"
                        : "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                    }`}
                  >
                    {isClosed ? <Lock size={12} /> : <Unlock size={12} />}
                    {isClosed ? "Closed" : "Open"}
                  </span>

                  <p className="font-semibold text-white">{rule.title}</p>
                </div>

                <p className="mt-2 text-sm text-white/65">
                  {rule.start_date} → {rule.end_date}
                </p>

                {rule.description ? (
                  <p className="mt-2 text-sm text-white/45">
                    {rule.description}
                  </p>
                ) : null}

                {rule.applies_to_role || rule.applies_to_department ? (
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {rule.applies_to_role ? (
                      <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-white/60">
                        Role: {rule.applies_to_role}
                      </span>
                    ) : null}

                    {rule.applies_to_department ? (
                      <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-white/60">
                        Department: {rule.applies_to_department}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => onDelete(rule.id)}
                disabled={deletingId === rule.id}
                className="shrink-0 rounded-xl border border-red-500/20 bg-red-500/10 p-2 text-red-300 hover:bg-red-500/20 disabled:opacity-60"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
