import type { SocialQueueItem } from "../../../lib/hooks/useSocialPosts";
import PlatformBadge from "./PlatformBadge";

function groupByDay(items: SocialQueueItem[]) {
  const groups = new Map<string, SocialQueueItem[]>();

  items.forEach((item) => {
    const key = new Date(item.scheduledFor).toDateString();
    const current = groups.get(key) ?? [];
    current.push(item);
    groups.set(key, current);
  });

  return Array.from(groups.entries()).map(([day, dayItems]) => ({
    day,
    items: dayItems.sort(
      (left, right) =>
        new Date(left.scheduledFor).getTime() -
        new Date(right.scheduledFor).getTime(),
    ),
  }));
}

export default function CalendarView({ items }: { items: SocialQueueItem[] }) {
  const days = groupByDay(items).slice(0, 6);

  if (days.length === 0) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/45">
        No scheduled social activity yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {days.map((day) => (
        <div
          key={day.day}
          className="rounded-3xl border border-white/10 bg-white/5 p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/55">
              {new Date(day.day).toLocaleDateString(undefined, {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </h3>
            <span className="text-xs text-white/35">
              {day.items.length} items
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {day.items.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <PlatformBadge platform={item.platform} />
                    <p className="text-sm font-medium text-white">
                      {item.title}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-white/45">
                    {item.clientName} · {item.campaignName}
                  </p>
                </div>

                <div className="text-sm text-white/65">
                  {new Date(item.scheduledFor).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
