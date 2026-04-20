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
  locales: {
    "en-US": enUS,
  },
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

type EverhourCalendarProps = {
  entries?: AdminTimeEntryRow[];
  calendarData?: CalendarTimeEntry[];
  onSelectEvent: (event: EverhourCalendarEvent) => void;
};

export default function EverhourCalendar({
  entries,
  calendarData,
  onSelectEvent,
}: EverhourCalendarProps) {
  const [currentView, setCurrentView] = useState<View>(Views.MONTH as View);

  const events = useMemo(() => {
    const grouped = new Map<string, EverhourCalendarEvent>();

    if (calendarData) {
      for (const entry of calendarData) {
        const dateKey = entry.entry_date;
        const userKey = `${entry.user_id}-${dateKey}`;

        const startDate = new Date(entry.entry_date);
        const endDate = startDate;

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

        const projects = normalizedProjects.reduce<
          EverhourCalendarEvent["resource"]["projects"]
        >(
          (
            acc: EverhourCalendarEvent["resource"]["projects"],
            proj: {
              project_id: string | null;
              hours: number;
              project_name: string | null | undefined;
              is_billable: boolean;
            },
          ) => {
            const existing = acc.find(
              (p: EverhourCalendarEvent["resource"]["projects"][number]) =>
                p.projectId === proj.project_id,
            );
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
          title: `${entry.user_name || "Unknown"} - ${totalHours.toFixed(1)}h`,
          start: startDate,
          end: endDate,
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
        const dateKey = entry.started_at.slice(0, 10); // YYYY-MM-DD
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
        } else {
          grouped.set(userKey, {
            id: userKey,
            title: `${entry.user_name || "Unknown"} - ${hours.toFixed(1)}h`,
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
  };

  return (
    <div className="h-150 text-white">
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
        eventPropGetter={(_event: EverhourCalendarEvent) => ({
          style: {
            backgroundColor: "#f97316", // orange-500
            borderRadius: "6px",
            opacity: 0.8,
            color: "white",
            border: "0px",
            display: "block",
          },
        })}
        components={{
          toolbar: ({ label }) => (
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">{label}</h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentView(Views.MONTH)}
                  className={`rounded px-3 py-1 text-sm ${
                    currentView === Views.MONTH
                      ? "bg-orange-500 text-black"
                      : "bg-white/10 text-white"
                  }`}
                >
                  Month
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentView(Views.WEEK)}
                  className={`rounded px-3 py-1 text-sm ${
                    currentView === Views.WEEK
                      ? "bg-orange-500 text-black"
                      : "bg-white/10 text-white"
                  }`}
                >
                  Week
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentView(Views.DAY)}
                  className={`rounded px-3 py-1 text-sm ${
                    currentView === Views.DAY
                      ? "bg-orange-500 text-black"
                      : "bg-white/10 text-white"
                  }`}
                >
                  Day
                </button>
              </div>
            </div>
          ),
        }}
      />
    </div>
  );
}
