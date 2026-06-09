import {
  CalendarClock,
  ClipboardList,
  MapPinned,
  PlaneTakeoff,
  Radio,
  Route,
  ShieldAlert,
  Truck,
  Users,
} from "lucide-react";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import { useAuth } from "../../../app/providers/AuthProvider";

type TourismView = "overview" | "bookings" | "itineraries" | "guests" | "transfers";

type WorkItem = {
  label: string;
  value: string;
  hint: string;
  icon: typeof CalendarClock;
};

const viewTitles: Record<TourismView, { title: string; subtitle: string }> = {
  overview: {
    title: "Tourism Operations",
    subtitle: "Coordinate bookings, guest movement, guides, transfers and activity readiness.",
  },
  bookings: {
    title: "Bookings Desk",
    subtitle: "Track reservations, confirmations, activity capacity and arrival windows.",
  },
  itineraries: {
    title: "Itineraries",
    subtitle: "Prepare daily guest plans, handovers, pickups and activity timing.",
  },
  guests: {
    title: "Guest Relations",
    subtitle: "Manage guest notes, special requests, incidents and service follow-up.",
  },
  transfers: {
    title: "Transfers",
    subtitle: "Coordinate drivers, vehicles, pickup points and route readiness.",
  },
};

const overviewItems: WorkItem[] = [
  {
    label: "Arrivals",
    value: "Ready",
    hint: "Guest arrivals, pickup windows and front-desk handovers",
    icon: PlaneTakeoff,
  },
  {
    label: "Activities",
    value: "Scheduled",
    hint: "Falls tours, cruises, game drives and guide assignments",
    icon: MapPinned,
  },
  {
    label: "Transfers",
    value: "Coordinated",
    hint: "Drivers, vehicles, pickup points and route notes",
    icon: Truck,
  },
  {
    label: "Guest Care",
    value: "Monitored",
    hint: "Special requests, incidents and service recovery",
    icon: ShieldAlert,
  },
];

const viewItems: Record<TourismView, WorkItem[]> = {
  overview: overviewItems,
  bookings: [
    {
      label: "New reservations",
      value: "Queue",
      hint: "Confirm availability, guest details and payment status",
      icon: ClipboardList,
    },
    {
      label: "Capacity",
      value: "Live",
      hint: "Avoid overbooking activity slots and vehicle capacity",
      icon: Users,
    },
    {
      label: "Confirmations",
      value: "Pending",
      hint: "Send guest confirmations and internal handover notes",
      icon: Radio,
    },
  ],
  itineraries: [
    {
      label: "Daily plan",
      value: "Built",
      hint: "Arrival, breakfast, activity, transfer and departure timing",
      icon: CalendarClock,
    },
    {
      label: "Guide notes",
      value: "Visible",
      hint: "Assigned guides see guest context and activity requirements",
      icon: MapPinned,
    },
    {
      label: "Handovers",
      value: "Tracked",
      hint: "Shift-to-shift operational notes stay attached to the itinerary",
      icon: ClipboardList,
    },
  ],
  guests: [
    {
      label: "Guest profiles",
      value: "Central",
      hint: "Preferences, dietary notes, VIP markers and contact details",
      icon: Users,
    },
    {
      label: "Requests",
      value: "Open",
      hint: "Special occasions, accessibility needs and service requests",
      icon: Radio,
    },
    {
      label: "Incidents",
      value: "Logged",
      hint: "Escalations, lost items, complaints and recovery actions",
      icon: ShieldAlert,
    },
  ],
  transfers: [
    {
      label: "Pickup board",
      value: "Live",
      hint: "Hotel, airport, activity and border transfer pickup windows",
      icon: Route,
    },
    {
      label: "Vehicles",
      value: "Assigned",
      hint: "Vehicle allocation, fuel readiness and service checks",
      icon: Truck,
    },
    {
      label: "Drivers",
      value: "Briefed",
      hint: "Driver assignments, guest contacts and route notes",
      icon: Users,
    },
  ],
};

export default function TourismOperationsPage({ view = "overview" }: { view?: TourismView }) {
  const auth = useAuth();
  const profile = auth?.profile;
  const heading = viewTitles[view];
  const items = viewItems[view];

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <Sidebar role={profile?.primary_role ?? profile?.organization_role_key ?? "manager"} />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-300">
                Victoria Falls Ready
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-normal text-white">
                {heading.title}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">
                {heading.subtitle}
              </p>
            </div>
            <div className="rounded-xl border border-teal-400/25 bg-teal-400/10 px-4 py-3 text-sm text-teal-100">
              Feature controlled by Platform Admin
            </div>
          </div>

          <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-xl border border-white/10 bg-[#0b0d0d] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-white/40">{item.label}</p>
                      <p className="mt-2 text-2xl font-bold text-white">{item.value}</p>
                    </div>
                    <span className="rounded-lg bg-teal-400/10 p-2 text-teal-300">
                      <Icon size={18} />
                    </span>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-white/55">{item.hint}</p>
                </div>
              );
            })}
          </section>

          <section className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-xl border border-white/10 bg-[#0b0d0d] p-5">
              <h2 className="text-lg font-semibold text-white">Operations Board</h2>
              <div className="mt-4 divide-y divide-white/10">
                {[
                  "Morning activity readiness",
                  "Guest transfer handover",
                  "Guide and driver briefing",
                  "Incident and special request review",
                ].map((label) => (
                  <div key={label} className="flex items-center justify-between gap-3 py-3">
                    <span className="text-sm text-white/75">{label}</span>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/50">
                      Planned
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-[#0b0d0d] p-5">
              <h2 className="text-lg font-semibold text-white">Role Boundary</h2>
              <p className="mt-3 text-sm leading-6 text-white/55">
                Tourism managers coordinate operations. Platform and organization admins keep control of billing, roles,
                subscriptions and feature access.
              </p>
              <div className="mt-4 grid gap-2 text-sm text-white/65">
                <span>Admins can access this module when enabled.</span>
                <span>Tourism staff get focused operational access.</span>
                <span>ITsNomatata can keep this module disabled.</span>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
