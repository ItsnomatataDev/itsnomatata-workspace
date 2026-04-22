import { useMemo, useState } from "react";
import {
  Calendar,
  dateFnsLocalizer,
  Views,
  type View,
} from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import type {
  AdminTimeEntryRow,
  CalendarTimeEntry,
} from "../../../lib/supabase/queries/adminTime";

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales: { "en-US": enUS },
});

export type EverhourCalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: {
    userId: string;
    userName: string;
    userEmail: string;
    totalHours: number;
    projects: Array<{
      projectId: string | null;
      projectName: string | null;
      hours: number;
      isBillable: boolean;
    }>;
  };
};

// Deterministic color per user based on their userId
const USER_COLORS = [
  { bg: "#f97316", light: "rgba(249,115,22,0.15)" }, // orange
  { bg: "#3b82f6", light: "rgba(59,130,246,0.15)" }, // blue
  { bg: "#10b981", light: "rgba(16,185,129,0.15)" }, // emerald
  { bg: "#8b5cf6", light: "rgba(139,92,246,0.15)" }, // violet
  { bg: "#f59e0b", light: "rgba(245,158,11,0.15)" }, // amber
  { bg: "#ec4899", light: "rgba(236,72,153,0.15)" }, // pink
  { bg: "#06b6d4", light: "rgba(6,182,212,0.15)" }, // cyan
  { bg: "#84cc16", light: "rgba(132,204,22,0.15)" }, // lime
];

function getUserColor(userId: string) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}

type EverhourCalendarProps = {
  entries?: AdminTimeEntryRow[];
  calendarData?: CalendarTimeEntry[];
  selectedUserId?: string | null;
  onSelectEvent: (event: EverhourCalendarEvent) => void;
  onSelectUser?: (userId: string) => void;
};

export default function EverhourCalendar({
  entries,
  calendarData,
  selectedUserId,
  onSelectEvent,
  onSelectUser,
}: EverhourCalendarProps) {
  const [currentView, setCurrentView] = useState<View>(Views.MONTH as View);

  const events = useMemo(() => {
    const grouped = new Map<string, EverhourCalendarEvent>();

    if (calendarData) {
      for (const entry of calendarData) {
        const dateKey = entry.entry_date;
        const userKey = `${entry.user_id}-${dateKey}`;
        const startDate = new Date(entry.entry_date);
        const totalHours = entry.total_seconds / 3600;

        const rawProjects = entry.project_entries;
        const normalizedProjects: Array<{
          project_id: string | null;
          hours: number;
          project_name: string | null | undefined;
          is_billable: boolean;
        }> = Array.isArray(rawProjects)
          ? rawProjects
          : typeof rawProjects === "string"
            ? JSON.parse(rawProjects)
            : [];

        const projects = normalizedProjects.reduce(
          (acc, proj) => {
            const existing = acc.find((p) => p.projectId === proj.project_id);
            if (existing) {
              existing.hours += proj.hours;
            } else {
              acc.push({
                projectId: proj.project_id,
                projectName: proj.project_name ?? null,
                hours: proj.hours,
                isBillable: proj.is_billable,
              });
            }
            return acc;
          },
          [] as EverhourCalendarEvent["resource"]["projects"],
        );

        grouped.set(userKey, {
          id: userKey,
          title: `${entry.user_name || "Unknown"} · ${totalHours.toFixed(1)}h`,
          start: startDate,
          end: startDate,
          resource: {
            userId: entry.user_id,
            userName: entry.user_name || "Unknown",
            userEmail: entry.user_email || "",
            totalHours,
            projects,
          },
        });
      }
    } else if (entries) {
      for (const entry of entries) {
        const dateKey = entry.started_at.slice(0, 10);
        const userKey = `${entry.user_id}-${dateKey}`;
        const startDate = new Date(entry.started_at);
        const endDate = entry.ended_at ? new Date(entry.ended_at) : startDate;
        const hours = Number(entry.duration_seconds ?? 0) / 3600;

        const existing = grouped.get(userKey);
        if (existing) {
          existing.resource.totalHours += hours;
          const projectIndex = existing.resource.projects.findIndex(
            (p) => p.projectId === entry.project_id,
          );
          if (projectIndex >= 0) {
            existing.resource.projects[projectIndex].hours += hours;
          } else {
            existing.resource.projects.push({
              projectId: entry.project_id,
              projectName: entry.project_name ?? null,
              hours,
              isBillable: entry.is_billable,
            });
          }
          // Update title with new total
          existing.title = `${existing.resource.userName} · ${existing.resource.totalHours.toFixed(1)}h`;
        } else {
          grouped.set(userKey, {
            id: userKey,
            title: `${entry.user_name || "Unknown"} · ${hours.toFixed(1)}h`,
            start: startDate,
            end: endDate,
            resource: {
              userId: entry.user_id,
              userName: entry.user_name || "Unknown",
              userEmail: entry.user_email || "",
              totalHours: hours,
              projects: [
                {
                  projectId: entry.project_id,
                  projectName: entry.project_name ?? null,
                  hours,
                  isBillable: entry.is_billable,
                },
              ],
            },
          });
        }
      }
    }

    return Array.from(grouped.values());
  }, [entries, calendarData]);

  const handleSelectEvent = (event: EverhourCalendarEvent) => {
    onSelectEvent(event);
    onSelectUser?.(event.resource.userId);
  };

  return (
    <div className="rbc-dark-theme" style={{ height: 600 }}>
      <style>{`
        /* ── Base overrides for dark theme ── */
        .rbc-dark-theme .rbc-calendar {
          background: transparent;
          color: rgba(255,255,255,0.85);
          font-family: inherit;
        }
        .rbc-dark-theme .rbc-month-view,
        .rbc-dark-theme .rbc-time-view,
        .rbc-dark-theme .rbc-agenda-view {
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px;
          overflow: hidden;
          background: rgba(0,0,0,0.5);
        }
        .rbc-dark-theme .rbc-header {
          background: rgba(0,0,0,0.6);
          border-bottom: 1px solid rgba(255,255,255,0.07);
          color: rgba(255,255,255,0.4);
          font-size: 11px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          padding: 8px 4px;
          font-weight: 500;
        }
        .rbc-dark-theme .rbc-header + .rbc-header {
          border-left: 1px solid rgba(255,255,255,0.06);
        }
        .rbc-dark-theme .rbc-month-row {
          border-top: 1px solid rgba(255,255,255,0.05);
        }
        .rbc-dark-theme .rbc-day-bg {
          border-left: 1px solid rgba(255,255,255,0.05);
          transition: background 0.15s;
        }
        .rbc-dark-theme .rbc-day-bg:hover {
          background: rgba(255,255,255,0.02);
        }
        .rbc-dark-theme .rbc-off-range-bg {
          background: rgba(0,0,0,0.3);
        }
        .rbc-dark-theme .rbc-today {
          background: rgba(249,115,22,0.06);
        }
        .rbc-dark-theme .rbc-date-cell {
          color: rgba(255,255,255,0.35);
          font-size: 11px;
          padding: 4px 6px;
          text-align: right;
        }
        .rbc-dark-theme .rbc-date-cell.rbc-now {
          color: #f97316;
          font-weight: 700;
        }
        .rbc-dark-theme .rbc-event {
          border: none !important;
          border-radius: 6px !important;
          font-size: 11px !important;
          font-weight: 600 !important;
          padding: 2px 6px !important;
          cursor: pointer !important;
          transition: opacity 0.15s, transform 0.1s !important;
        }
        .rbc-dark-theme .rbc-event:hover {
          opacity: 1 !important;
          transform: scale(1.02) !important;
        }
        .rbc-dark-theme .rbc-event.rbc-selected {
          box-shadow: 0 0 0 2px rgba(255,255,255,0.3) !important;
        }
        .rbc-dark-theme .rbc-show-more {
          color: rgba(249,115,22,0.8);
          font-size: 11px;
          font-weight: 600;
          background: transparent;
        }
        .rbc-dark-theme .rbc-toolbar button {
          display: none;
        }
        .rbc-dark-theme .rbc-toolbar {
          display: none;
        }
        /* Time grid */
        .rbc-dark-theme .rbc-time-header {
          border-bottom: 1px solid rgba(255,255,255,0.07);
        }
        .rbc-dark-theme .rbc-time-content {
          border-top: 1px solid rgba(255,255,255,0.05);
        }
        .rbc-dark-theme .rbc-timeslot-group {
          border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .rbc-dark-theme .rbc-time-slot {
          color: rgba(255,255,255,0.25);
          font-size: 10px;
        }
        .rbc-dark-theme .rbc-current-time-indicator {
          background: #f97316;
        }
      `}</style>

      <Calendar<EverhourCalendarEvent>
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: "100%" }}
        views={[Views.MONTH, Views.WEEK, Views.DAY]}
        view={currentView}
        onView={setCurrentView}
        onSelectEvent={handleSelectEvent}
        eventPropGetter={(event) => {
          const color = getUserColor(event.resource.userId);
          const isSelected = selectedUserId === event.resource.userId;
          return {
            style: {
              backgroundColor: isSelected ? color.bg : color.light,
              color: isSelected ? "#fff" : color.bg,
              border: `1px solid ${isSelected ? "transparent" : color.bg}`,
              borderRadius: "6px",
              opacity: selectedUserId && !isSelected ? 0.4 : 0.95,
              fontWeight: 600,
              fontSize: "11px",
              padding: "2px 6px",
              transition: "all 0.15s",
            },
          };
        }}
        components={{
          toolbar: ({ label, onNavigate }) => (
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onNavigate("PREV")}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white text-sm"
                >
                  ‹
                </button>
                <h3 className="min-w-40 text-center text-base font-semibold text-white">
                  {label}
                </h3>
                <button
                  type="button"
                  onClick={() => onNavigate("NEXT")}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white text-sm"
                >
                  ›
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate("TODAY")}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/60 transition hover:bg-white/10 hover:text-white"
                >
                  Today
                </button>
              </div>

              <div className="flex gap-1.5">
                {([Views.MONTH, Views.WEEK, Views.DAY] as View[]).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setCurrentView(v)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-medium capitalize transition ${
                      currentView === v
                        ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                        : "border border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          ),

          event: ({ event }) => {
            const color = getUserColor(event.resource.userId);
            const isSelected = selectedUserId === event.resource.userId;
            return (
              <div
                title={`${event.resource.userName}\n${event.resource.totalHours.toFixed(1)}h\n${event.resource.projects.map((p) => `• ${p.projectName ?? "No project"}: ${p.hours.toFixed(1)}h`).join("\n")}`}
                className="flex items-center gap-1 truncate"
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: isSelected ? "#fff" : color.bg }}
                />
                <span className="truncate">
                  {event.resource.userName.split(" ")[0]}{" "}
                  <span className="opacity-75">
                    {event.resource.totalHours.toFixed(1)}h
                  </span>
                </span>
              </div>
            );
          },
        }}
      />
    </div>
  );
}
