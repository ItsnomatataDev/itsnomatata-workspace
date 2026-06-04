import { AlertTriangle } from "lucide-react";
import type { LocationStatusEvent } from "../types";
import { formatDayLabel } from "../utils/calendarDates";

export default function StatusAlertBanner({
  events,
}: {
  events: LocationStatusEvent[];
}) {
  if (events.length === 0) return null;

  return (
    <div className="mb-4 space-y-2">
      {events.map((event) => (
        <div
          key={event.id}
          className="rounded-2xl bg-gray-900 px-4 py-3 text-white"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 shrink-0 text-orange-400" size={18} />
            <div>
              <p className="text-sm font-semibold text-orange-400">{event.title}</p>
              <p className="mt-1 text-sm text-white/85">
                {event.reason || event.notes || "Location schedule is affected."}
              </p>
              <p className="mt-1 text-xs text-white/55">
                {formatDayLabel(event.start_date)} – {formatDayLabel(event.end_date)} ·{" "}
                {event.status}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
