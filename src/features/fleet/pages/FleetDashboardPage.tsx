import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Fuel,
  Gauge,
  Loader2,
  Plus,
  RefreshCw,
  Route,
  Truck,
  Wrench,
  XCircle,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import { useAuth } from "../../../app/providers/AuthProvider";
import {
  createMaintenanceRecord,
  createFuelPurchase,
  fetchFleetDashboardData,
  notifyFleetServiceStatus,
  type CreateMaintenanceRecordInput,
  type CreateFuelPurchaseInput,
  type FleetDashboardData,
  type FleetDashboardDateRange,
  type FleetDailySummary,
  type FleetFuelPurchase,
  type FleetImportBatch,
  type FleetImportRow,
  type FleetMaintenanceRecord,
  type FleetServiceSchedule,
  type FleetVehicle,
} from "../services/fleetService";

const EMPTY_DATA: FleetDashboardData = {
  vehicles: [],
  summaries: [],
  batches: [],
  rows: [],
  fuelPurchases: [],
  serviceSchedules: [],
  maintenanceRecords: [],
};

type DateRangeFilter = "day" | "week" | "month" | "7d" | "30d" | "custom";
type ImportStatusFilter = "all" | "completed" | "attention";
type FleetSortMode =
  | "newest"
  | "oldest"
  | "next-service"
  | "last-service";
type ServiceStatus = "overdue" | "soon" | "ok";
type ServiceCalendarMode = "day" | "week" | "month";
type VehicleStatusFilter = "all" | "active" | "maintenance" | "inactive";
type FuelPurchaseFormState = {
  vehicleId: string;
  purchaseDate: string;
  litres: string;
  totalCost: string;
  currency: string;
  odometerKm: string;
  stationName: string;
  paymentMethod: string;
  receiptNumber: string;
  notes: string;
};
type MaintenanceFormState = {
  vehicleId: string;
  serviceDate: string;
  odometerKm: string;
  serviceType: string;
  nextServiceDate: string;
  nextServiceOdometerKm: string;
  provider: string;
  cost: string;
  currency: string;
  receiptUrl: string;
  notes: string;
};

type ChartDatum = {
  date: string;
  routeKm: number;
  fuelLitres: number;
  stopHours: number;
};

function formatNumber(value: number | null | undefined, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(Number(value));
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDuration(seconds: number | null | undefined) {
  const total = Math.max(0, Math.round(Number(seconds ?? 0)));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);

  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function statusClass(status: string) {
  switch (status) {
    case "completed":
    case "imported":
    case "active":
      return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
    case "partial_failed":
    case "processing":
    case "unmatched":
      return "border-amber-400/30 bg-amber-500/10 text-amber-200";
    case "failed":
      return "border-red-400/30 bg-red-500/10 text-red-200";
    default:
      return "border-white/10 bg-white/5 text-white/70";
  }
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${statusClass(
        status,
      )}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function MetricCard({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: string;
  helper: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/4 p-5 shadow-lg shadow-black/20">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-white/55">{label}</p>
          <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
          <p className="mt-2 text-xs text-white/40">{helper}</p>
        </div>
        <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 p-3 text-orange-300">
          {icon}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/3 p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/50">
        <Truck size={22} />
      </div>
      <h3 className="mt-4 text-base font-semibold text-white">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm text-white/50">{message}</p>
    </div>
  );
}

function selectClassName() {
  return "rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none transition focus:border-orange-400/70";
}

function inputClassName() {
  return "w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-orange-400/70";
}

function normalizeKey(value?: string | null) {
  return String(value ?? "").trim().toLowerCase();
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDateKey(value?: string | null) {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfCalendarWeek(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  const day = next.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + offset);
  return next;
}

function endOfCalendarWeek(date: Date) {
  return addDays(startOfCalendarWeek(date), 6);
}

function startOfCalendarMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfCalendarMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function differenceInCalendarDays(left: Date, right: Date) {
  const leftDate = new Date(left);
  const rightDate = new Date(right);
  leftDate.setHours(0, 0, 0, 0);
  rightDate.setHours(0, 0, 0, 0);
  return Math.round((leftDate.getTime() - rightDate.getTime()) / 86400000);
}

function isDateInRange(dateKey: string | null | undefined, start: Date, end: Date) {
  const date = parseDateKey(dateKey);
  if (!date) return false;
  return date >= start && date <= end;
}

function getServiceCalendarRange(date: Date, mode: ServiceCalendarMode) {
  const selected = new Date(date);
  selected.setHours(0, 0, 0, 0);

  if (mode === "week") {
    return {
      start: startOfCalendarWeek(selected),
      end: endOfCalendarWeek(selected),
    };
  }

  if (mode === "month") {
    return {
      start: startOfCalendarMonth(selected),
      end: endOfCalendarMonth(selected),
    };
  }

  return { start: selected, end: selected };
}

function formatRangeLabel(start: Date, end: Date) {
  if (toDateKey(start) === toDateKey(end)) return formatDate(toDateKey(start));
  return `${formatDate(toDateKey(start))} - ${formatDate(toDateKey(end))}`;
}

function getMonthDay(value?: string | null) {
  const date = parseDateKey(value);
  if (!date) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function getWeekday(value?: string | null) {
  const date = parseDateKey(value);
  if (!date) return "-";
  return new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(date);
}

function getFleetDateRange(range: DateRangeFilter): FleetDashboardDateRange {
  if (range === "day") {
    return { mode: "latest-import-day" };
  }

  const end = new Date();
  end.setHours(0, 0, 0, 0);

  const start = new Date(end);
  const days = range === "week" || range === "7d" ? 7 : 30;
  start.setDate(start.getDate() - days);

  return {
    mode: "fixed",
    startDate: toDateKey(start),
    endDate: toDateKey(end),
  };
}

function getVehicleServiceSource(
  vehicle: FleetVehicle,
  schedules: FleetServiceSchedule[],
) {
  const activeSchedules = schedules.filter(
    (schedule) =>
      schedule.vehicle_id === vehicle.id && schedule.status !== "archived",
  );
  const byNextService = activeSchedules
    .slice()
    .sort((a, b) => {
      const aOdo = a.next_service_odometer_km ?? Number.POSITIVE_INFINITY;
      const bOdo = b.next_service_odometer_km ?? Number.POSITIVE_INFINITY;
      const odoDiff = aOdo - bOdo;
      if (odoDiff !== 0) return odoDiff;
      return String(a.next_service_date ?? "9999-12-31").localeCompare(
        String(b.next_service_date ?? "9999-12-31"),
      );
    })[0];

  return {
    schedule: byNextService ?? null,
    lastServiceDate:
      byNextService?.last_service_date ?? vehicle.last_service_date ?? null,
    lastServiceOdo:
      byNextService?.last_service_odometer_km ??
      vehicle.last_service_odometer_km ??
      null,
    nextServiceDate:
      byNextService?.next_service_date ?? vehicle.next_service_date ?? null,
    nextServiceOdo:
      byNextService?.next_service_odometer_km ??
      vehicle.next_service_odometer_km ??
      null,
  };
}

function getServiceStatus(
  currentOdo?: number | null,
  nextServiceOdo?: number | null,
  nextServiceDate?: string | null,
  estimatedDaysToService?: number | null,
): { status: ServiceStatus; remainingKm: number | null } {
  const hasOdo =
    currentOdo !== null &&
    currentOdo !== undefined &&
    nextServiceOdo !== null &&
    nextServiceOdo !== undefined;

  const remainingKm = hasOdo
    ? Number(nextServiceOdo) - Number(currentOdo)
    : null;

  const isOdoOverdue = remainingKm !== null && remainingKm <= 0;
  const isOdoSoon =
    remainingKm !== null && remainingKm > 0 && remainingKm <= 1000;

  const nextDate = parseDateKey(nextServiceDate);
  const daysUntilService = nextDate
    ? differenceInCalendarDays(nextDate, new Date())
    : null;

  const isDateSoon =
    daysUntilService !== null &&
    daysUntilService >= 0 &&
    daysUntilService <= 14;

  const isUsageSoon =
    estimatedDaysToService !== null &&
    estimatedDaysToService !== undefined &&
    estimatedDaysToService >= 0 &&
    estimatedDaysToService <= 14;

  const status = isOdoOverdue
    ? "overdue"
    : isOdoSoon || isDateSoon || isUsageSoon
      ? "soon"
      : "ok";

  return { status, remainingKm };
}

function getLatestVehicleOdometer(
  vehicle: FleetVehicle,
  summaries: FleetDailySummary[],
) {
  const latestSummary = summaries
    .filter(
      (summary) =>
        summary.vehicle_id === vehicle.id &&
        summary.odometer_km !== null &&
        summary.odometer_km !== undefined,
    )
    .sort((a, b) => b.summary_date.localeCompare(a.summary_date))[0];

  return latestSummary?.odometer_km ?? vehicle.current_odometer_km ?? null;
}

function getAverageDailyKm(vehicleId: string, summaries: FleetDailySummary[]) {
  const readings = summaries
    .filter(
      (summary) =>
        summary.vehicle_id === vehicleId &&
        summary.odometer_km !== null &&
        summary.odometer_km !== undefined,
    )
    .map((summary) => ({
      date: summary.summary_date,
      odometer: Number(summary.odometer_km),
    }))
    .filter((reading) => Number.isFinite(reading.odometer))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (readings.length < 2) {
    return null;
  }

  const oldest = readings[0];
  const latest = readings[readings.length - 1];

  const oldestDate = new Date(`${oldest.date}T00:00:00`);
  const latestDate = new Date(`${latest.date}T00:00:00`);

  if (
    Number.isNaN(oldestDate.getTime()) ||
    Number.isNaN(latestDate.getTime())
  ) {
    return null;
  }

  const totalDays = Math.max(
    1,
    Math.ceil(
      (latestDate.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24),
    ),
  );

  const totalDistance = latest.odometer - oldest.odometer;

  if (!Number.isFinite(totalDistance) || totalDistance <= 0) {
    return null;
  }

  const averageDailyKm = totalDistance / totalDays;

  return Number(averageDailyKm.toFixed(2));
}

function getEstimatedDaysToService(params: {
  vehicleId: string;
  summaries: FleetDailySummary[];
  remainingKm: number | null;
}) {
  if (params.remainingKm === null) return null;
  if (params.remainingKm <= 0) return 0;

  const averageDailyKm = getAverageDailyKm(params.vehicleId, params.summaries);

  if (!averageDailyKm) return null;

  return params.remainingKm / averageDailyKm;
}

function calculateEstimatedNextServiceDate(params: {
  vehicleId: string;
  serviceDate: string;
  serviceOdometerKm: number | null;
  nextServiceOdometerKm: number | null;
  summaries: FleetDailySummary[];
}) {
  if (
    params.serviceOdometerKm === null ||
    params.nextServiceOdometerKm === null
  ) {
    return null;
  }

  const averageDailyKm = getAverageDailyKm(params.vehicleId, params.summaries);

  if (!averageDailyKm || averageDailyKm <= 0) {
    return null;
  }

  const remainingDistance =
    Number(params.nextServiceOdometerKm) - Number(params.serviceOdometerKm);

  if (remainingDistance <= 0) {
    return null;
  }

  const estimatedDays = Math.ceil(remainingDistance / averageDailyKm);

  const baseDate = new Date(`${params.serviceDate}T00:00:00`);

  if (Number.isNaN(baseDate.getTime())) {
    return null;
  }

  baseDate.setDate(baseDate.getDate() + estimatedDays);

  return baseDate.toISOString().slice(0, 10);
}

function getVehicleServiceStatus(params: {
  vehicle: FleetVehicle;
  schedules: FleetServiceSchedule[];
  summaries: FleetDailySummary[];
}) {
  const service = getVehicleServiceSource(params.vehicle, params.schedules);
  const currentOdo = getLatestVehicleOdometer(params.vehicle, params.summaries);
  const remainingKm =
    currentOdo !== null && service.nextServiceOdo !== null
      ? Number(service.nextServiceOdo) - Number(currentOdo)
      : null;

  const estimatedDaysToService = getEstimatedDaysToService({
    vehicleId: params.vehicle.id,
    summaries: params.summaries,
    remainingKm,
  });

  const statusResult = getServiceStatus(
    currentOdo,
    service.nextServiceOdo,
    service.nextServiceDate,
    estimatedDaysToService,
  );

  return {
    service,
    currentOdo,
    estimatedDaysToService,
    ...statusResult,
  };
}

function vehicleActiveBadgeClass(status: ServiceStatus) {
  if (status === "overdue") {
    return "border-red-400/40 bg-red-500/20 text-red-200";
  }

  if (status === "soon") {
    return "border-orange-400/40 bg-orange-500/20 text-orange-200";
  }

  return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
}

function getVehicleLabel(summary: FleetDailySummary) {
  return summary.vehicle?.vehicle_name ?? "Unknown vehicle";
}

function getFuelPurchaseVehicleLabel(purchase: FleetFuelPurchase) {
  return purchase.vehicle?.vehicle_name ?? "Unknown vehicle";
}

function isWithinRange(
  summary: FleetDailySummary,
  range: ReturnType<typeof getFleetDateRange>,
) {
  if (range.mode === "latest-import-day") return true;

  return (
    summary.summary_date >= range.startDate && summary.summary_date <= range.endDate
  );
}

function buildChartData(summaries: FleetDailySummary[]): ChartDatum[] {
  const byDate = new Map<string, ChartDatum>();

  for (const summary of summaries) {
    const current =
      byDate.get(summary.summary_date) ??
      {
        date: summary.summary_date,
        routeKm: 0,
        fuelLitres: 0,
        stopHours: 0,
      };

    current.routeKm += summary.route_length_km;
    current.fuelLitres += Number(summary.fuel_consumption_litres ?? 0);
    current.stopHours += summary.stop_duration_seconds / 3600;
    byDate.set(summary.summary_date, current);
  }

  return Array.from(byDate.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((item) => ({
      ...item,
      routeKm: Number(item.routeKm.toFixed(2)),
      fuelLitres: Number(item.fuelLitres.toFixed(2)),
      stopHours: Number(item.stopHours.toFixed(2)),
    }));
}

function DuplicateVehicleWarning({
  duplicateLabels,
}: {
  duplicateLabels: string[];
}) {
  if (duplicateLabels.length === 0) return null;

  return (
    <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-2 text-amber-200">
          <AlertTriangle size={18} />
        </div>
        <div>
          <h3 className="font-semibold text-amber-100">
            Duplicate fleet vehicles detected
          </h3>
          <p className="mt-1 text-sm text-amber-100/70">
            These names or registrations appear more than once:{" "}
            {duplicateLabels.join(", ")}. Clean them up before relying on
            long-term trend reporting.
          </p>
        </div>
      </div>
    </div>
  );
}

function FleetTrendPanel({ chartData }: { chartData: ChartDatum[] }) {
  if (chartData.length === 0) {
    return (
      <EmptyState
        title="No trend data for this filter"
        message="Adjust the date or vehicle filter to view imported movement and fuel trends."
      />
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-5">
      <div className="rounded-2xl border border-white/10 bg-black p-5 xl:col-span-3">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-white">
              Distance trend
            </h3>
            <p className="text-sm text-white/45">
              Route kilometres by report date
            </p>
          </div>
          <Route size={18} className="text-orange-300" />
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="routeKm" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#f97316" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="#f97316" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="rgba(255,255,255,0.42)"
                tick={{ fontSize: 11 }}
                tickFormatter={(value: string) => value.slice(5)}
              />
              <YAxis stroke="rgba(255,255,255,0.42)" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: "#050505",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "12px",
                  color: "#fff",
                }}
              />
              <Area
                type="monotone"
                dataKey="routeKm"
                name="Route km"
                stroke="#fb923c"
                fill="url(#routeKm)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black p-5 xl:col-span-2">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-white">
              Fuel usage
            </h3>
            <p className="text-sm text-white/45">Litres by report date</p>
          </div>
          <Fuel size={18} className="text-orange-300" />
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="rgba(255,255,255,0.42)"
                tick={{ fontSize: 11 }}
                tickFormatter={(value: string) => value.slice(5)}
              />
              <YAxis stroke="rgba(255,255,255,0.42)" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: "#050505",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "12px",
                  color: "#fff",
                }}
              />
              <Bar
                dataKey="fuelLitres"
                name="Fuel litres"
                fill="#f97316"
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function serviceCardClass(status: ServiceStatus) {
  if (status === "overdue") return "border-red-500/40 bg-red-500/10";
  if (status === "soon") return "border-orange-400/40 bg-orange-500/10";
  return "border-white/10 bg-black";
}

function serviceBadgeClass(status: ServiceStatus) {
  if (status === "overdue") return "border-red-400/40 bg-red-500/20 text-red-200";
  if (status === "soon") return "border-orange-400/40 bg-orange-500/20 text-orange-200";
  return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
}

function serviceLabel(status: ServiceStatus) {
  if (status === "overdue") return "Service Overdue";
  if (status === "soon") return "Service Soon";
  return "Service OK";
}

function VehicleHealthGrid({
  vehicles,
  schedules,
  summaries,
}: {
  vehicles: FleetVehicle[];
  schedules: FleetServiceSchedule[];
  summaries: FleetDailySummary[];
}) {
  const visibleVehicles = vehicles.slice(0, 6);

  if (visibleVehicles.length === 0) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {visibleVehicles.map((vehicle) => {
        const {
          service,
          currentOdo,
          status,
          remainingKm,
          estimatedDaysToService,
        } = getVehicleServiceStatus({
          vehicle,
          schedules,
          summaries,
        });

        return (
          <div
            key={vehicle.id}
            className={`rounded-2xl border p-5 ${serviceCardClass(status)}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-white">
                  {vehicle.vehicle_name ??
                    vehicle.registration_number ??
                    "Vehicle"}
                </h3>
                <p className="mt-1 text-xs text-white/40">
                  {vehicle.registration_number ?? "No registration"}
                </p>
              </div>

              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${vehicleActiveBadgeClass(
                  status,
                )}`}
              >
                {status !== "ok" ? <AlertTriangle size={13} /> : null}
                {vehicle.status ?? "active"}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl border border-white/10 bg-white/3 p-3">
                <p className="text-white">{formatNumber(currentOdo, 0)} km</p>
                <p className="mt-1 text-xs text-white/40">
                  Latest EziTrack odo
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/3 p-3">
                <p className="text-white">
                  {formatNumber(service.lastServiceOdo, 0)} km
                </p>
                <p className="mt-1 text-xs text-white/40">Last service odo</p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/3 p-3">
                <p
                  className={
                    status === "overdue" ? "text-red-200" : "text-white"
                  }
                >
                  {formatNumber(service.nextServiceOdo, 0)} km
                </p>
                <p className="mt-1 text-xs text-white/40">Next service odo</p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/3 p-3">
                <p
                  className={
                    status === "overdue"
                      ? "text-red-200"
                      : status === "soon"
                        ? "text-orange-200"
                        : "text-white"
                  }
                >
                  {remainingKm === null
                    ? "-"
                    : `${formatNumber(Math.max(0, remainingKm), 0)} km`}
                </p>
                <p className="mt-1 text-xs text-white/40">Remaining</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-white/55">
              <p>Last: {formatDate(service.lastServiceDate)}</p>
              <p className={status === "overdue" ? "text-red-200" : undefined}>
                Next: {formatDate(service.nextServiceDate)}
              </p>
            </div>

            <div className="mt-3 text-xs text-white/45">
              Estimated days left:{" "}
              <span
                className={
                  status === "overdue"
                    ? "font-semibold text-red-200"
                    : status === "soon"
                      ? "font-semibold text-orange-200"
                      : "text-white"
                }
              >
                {estimatedDaysToService === null
                  ? "Using manual/default estimate"
                  : `${Math.max(0, Math.ceil(estimatedDaysToService))} days`}
              </span>
            </div>

            {status !== "ok" ? (
              <div
                className={`mt-4 rounded-xl border p-3 text-sm font-semibold ${
                  status === "overdue"
                    ? "border-red-400/30 bg-red-500/10 text-red-100"
                    : "border-orange-400/30 bg-orange-500/10 text-orange-100"
                }`}
              >
                {status === "overdue"
                  ? "Service is overdue. This vehicle has passed the next service odometer."
                  : "Service needed soon based on odometer/date estimate."}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
function FleetActivityGrid({
  summaries,
  schedules,
}: {
  summaries: FleetDailySummary[];
  schedules: FleetServiceSchedule[];
}) {
  const latestByVehicle = new Map<string, FleetDailySummary>();

  for (const summary of summaries) {
    if (!latestByVehicle.has(summary.vehicle_id)) {
      latestByVehicle.set(summary.vehicle_id, summary);
    }
  }

  const latest = Array.from(latestByVehicle.values()).slice(0, 6);

  if (latest.length === 0) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {latest.map((summary) => {
        const vehicle = summary.vehicle;
        const service = vehicle
          ? getVehicleServiceSource(vehicle, schedules)
          : null;

        const { status } = getServiceStatus(
          summary.odometer_km ?? vehicle?.current_odometer_km ?? null,
          service?.nextServiceOdo ?? null,
          service?.nextServiceDate ?? null,
        );

        return (
          <div
            key={summary.vehicle_id}
            className={`rounded-2xl border p-5 ${serviceCardClass(status)}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-white">
                  {getVehicleLabel(summary)}
                </h3>
                <p className="mt-1 text-xs text-white/40">
                  Last report {formatDate(summary.summary_date)}
                </p>
              </div>

              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${vehicleActiveBadgeClass(
                  status,
                )}`}
              >
                {summary.vehicle?.status ?? "active"}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-xl border border-white/10 bg-white/3 p-3">
                <p className="text-white">
                  {formatNumber(summary.route_length_km, 2)}
                </p>
                <p className="mt-1 text-xs text-white/40">km</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/3 p-3">
                <p className="text-white">
                  {formatNumber(summary.fuel_consumption_litres, 2)}
                </p>
                <p className="mt-1 text-xs text-white/40">litres</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/3 p-3">
                <p
                  className={
                    status === "overdue"
                      ? "text-red-200"
                      : status === "soon"
                        ? "text-orange-200"
                        : "text-white"
                  }
                >
                  {formatNumber(summary.odometer_km, 0)}
                </p>
                <p className="mt-1 text-xs text-white/40">odo</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FuelPurchasesTable({
  purchases,
}: {
  purchases: FleetFuelPurchase[];
}) {
  if (purchases.length === 0) {
    return (
      <EmptyState
        title="No fuel purchases recorded yet"
        message="Record real refuels here, then compare them against EziTrack estimated consumption."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-white/10">
          <thead className="bg-white/4">
            <tr>
              {[
                "Vehicle",
                "Purchase date",
                "Litres",
                "Cost",
                "Unit price",
                "Station",
                "Odometer",
              ].map((heading) => (
                <th
                  key={heading}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-white/45"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10 bg-black/20">
            {purchases.map((purchase) => (
              <tr key={purchase.id} className="hover:bg-white/3">
                <td className="px-4 py-4">
                  <p className="font-medium text-white">
                    {getFuelPurchaseVehicleLabel(purchase)}
                  </p>
                  <p className="mt-1 text-xs text-white/45">
                    {purchase.vehicle?.registration_number ?? "No registration"}
                  </p>
                </td>
                <td className="px-4 py-4 text-sm text-white/70">
                  {formatDateTime(purchase.purchase_date)}
                </td>
                <td className="px-4 py-4 text-sm text-white/70">
                  {formatNumber(purchase.litres, 2)} L
                </td>
                <td className="px-4 py-4 text-sm text-white/70">
                  {purchase.currency} {formatNumber(purchase.total_cost, 2)}
                </td>
                <td className="px-4 py-4 text-sm text-white/70">
                  {purchase.unit_price === null
                    ? "-"
                    : `${purchase.currency} ${formatNumber(purchase.unit_price, 4)}`}
                </td>
                <td className="px-4 py-4 text-sm text-white/70">
                  <p>{purchase.station_name ?? "-"}</p>
                  <p className="text-xs text-white/40">
                    {purchase.payment_method ?? purchase.receipt_number ?? ""}
                  </p>
                </td>
                <td className="px-4 py-4 text-sm text-white/70">
                  {formatNumber(purchase.odometer_km, 0)} km
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LastRefuelGrid({
  vehicles,
  purchases,
}: {
  vehicles: FleetVehicle[];
  purchases: FleetFuelPurchase[];
}) {
  const latestByVehicle = new Map<string, FleetFuelPurchase>();

  for (const purchase of purchases) {
    if (!latestByVehicle.has(purchase.vehicle_id)) {
      latestByVehicle.set(purchase.vehicle_id, purchase);
    }
  }

  const visibleVehicles = vehicles.slice(0, 6);

  if (visibleVehicles.length === 0) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {visibleVehicles.map((vehicle) => {
        const latest = latestByVehicle.get(vehicle.id);

        return (
          <div
            key={vehicle.id}
            className="rounded-2xl border border-white/10 bg-black p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-white">
                  {vehicle.vehicle_name ?? vehicle.registration_number ?? "Vehicle"}
                </h3>
                <p className="mt-1 text-xs text-white/40">
                  {vehicle.registration_number ?? "No registration"}
                </p>
              </div>
              <div className="rounded-xl border border-orange-500/20 bg-orange-500/10 p-2 text-orange-300">
                <Fuel size={17} />
              </div>
            </div>

            {latest ? (
              <div className="mt-5 space-y-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/35">
                    Last refueled
                  </p>
                  <p className="mt-1 text-lg font-semibold text-white">
                    {formatDate(latest.purchase_date)}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-xl border border-white/10 bg-white/3 p-3">
                    <p className="text-white">{formatNumber(latest.litres, 2)} L</p>
                    <p className="mt-1 text-xs text-white/40">Fuel bought</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/3 p-3">
                    <p className="text-white">
                      {latest.currency} {formatNumber(latest.total_cost, 2)}
                    </p>
                    <p className="mt-1 text-xs text-white/40">Total cost</p>
                  </div>
                </div>
                <p className="text-sm text-white/45">
                  {latest.station_name ?? "Station not recorded"}
                </p>
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-dashed border-white/10 bg-white/3 p-4">
                <p className="text-sm font-medium text-white">No refuel recorded</p>
                <p className="mt-1 text-xs text-white/45">
                  Add the first fuel purchase for this vehicle.
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FleetDateRangeCalendar({
  startDate,
  endDate,
  onChange,
  onUseCalendarRange,
}: {
  startDate: string;
  endDate: string;
  onChange: (range: { startDate: string; endDate: string }) => void;
  onUseCalendarRange: () => void;
}) {
  const anchorDate = parseDateKey(startDate) ?? new Date();
  const [visibleMonth, setVisibleMonth] = useState(
    startOfCalendarMonth(anchorDate),
  );
  const rangeStart = parseDateKey(startDate);
  const rangeEnd = parseDateKey(endDate);
  const gridStart = startOfCalendarWeek(startOfCalendarMonth(visibleMonth));
  const calendarDays = Array.from({ length: 42 }, (_, index) =>
    addDays(gridStart, index),
  );

  function handleSelectDate(date: Date) {
    const dateKey = toDateKey(date);
    onUseCalendarRange();

    if (!rangeStart || (rangeStart && rangeEnd)) {
      onChange({ startDate: dateKey, endDate: dateKey });
      return;
    }

    if (date < rangeStart) {
      onChange({ startDate: dateKey, endDate: toDateKey(rangeStart) });
      return;
    }

    onChange({ startDate: toDateKey(rangeStart), endDate: dateKey });
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black p-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-white/40">
            Report date range calendar
          </p>
          <h3 className="mt-1 text-lg font-semibold text-white">
            {formatRangeLabel(rangeStart ?? visibleMonth, rangeEnd ?? rangeStart ?? visibleMonth)}
          </h3>
          <p className="mt-1 text-sm text-white/45">
            Tap a start date, then tap an end date.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setVisibleMonth((current) => addMonths(current, -1))}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white/70 hover:bg-white/10"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setVisibleMonth(startOfCalendarMonth(new Date()))}
            className="rounded-xl border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-sm font-semibold text-orange-200 hover:bg-orange-500/15"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setVisibleMonth((current) => addMonths(current, 1))}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white/70 hover:bg-white/10"
          >
            Next
          </button>
        </div>
      </div>

      <div className="mb-2 text-center text-sm font-semibold text-white">
        {new Intl.DateTimeFormat("en-GB", {
          month: "long",
          year: "numeric",
        }).format(visibleMonth)}
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase tracking-wide text-white/40">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <div key={day} className="py-2">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((date) => {
          const dateKey = toDateKey(date);
          const inMonth = date.getMonth() === visibleMonth.getMonth();
          const isStart = rangeStart && dateKey === toDateKey(rangeStart);
          const isEnd = rangeEnd && dateKey === toDateKey(rangeEnd);
          const inRange =
            rangeStart && rangeEnd && date >= rangeStart && date <= rangeEnd;

          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => handleSelectDate(date)}
              className={`min-h-14 rounded-xl border p-2 text-left transition sm:min-h-16 ${
                isStart || isEnd
                  ? "border-orange-400 bg-orange-500 text-black"
                  : inRange
                    ? "border-orange-500/30 bg-orange-500/10 text-white"
                    : "border-white/10 bg-white/3 text-white hover:bg-white/10"
              } ${inMonth ? "" : "opacity-45"}`}
            >
              <span className="block text-sm font-semibold">
                {date.getDate()}
              </span>
              <span className="mt-1 block text-[11px]">
                {getWeekday(dateKey)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FleetServiceDatePicker({
  selectedDate,
  mode,
  vehicles,
  schedules,
  onSelectDate,
  onModeChange,
  onNavigate,
  onToday,
}: {
  selectedDate: Date;
  mode: ServiceCalendarMode;
  vehicles: FleetVehicle[];
  schedules: FleetServiceSchedule[];
  onSelectDate: (date: Date) => void;
  onModeChange: (mode: ServiceCalendarMode) => void;
  onNavigate: (direction: "previous" | "next") => void;
  onToday: () => void;
}) {
  const selectedKey = toDateKey(selectedDate);
  const range = getServiceCalendarRange(selectedDate, mode);
  const monthStart = startOfCalendarMonth(selectedDate);
  const gridStart = startOfCalendarWeek(monthStart);
  const calendarDays = Array.from({ length: 42 }, (_, index) =>
    addDays(gridStart, index),
  );
  const eventsByDate = new Map<string, number>();

  for (const vehicle of vehicles) {
    const service = getVehicleServiceSource(vehicle, schedules);
    if (!service.nextServiceDate) continue;
    eventsByDate.set(
      service.nextServiceDate,
      (eventsByDate.get(service.nextServiceDate) ?? 0) + 1,
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black p-4">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-white/40">
            Service calendar
          </p>
          <h3 className="mt-1 text-lg font-semibold text-white">
            {formatRangeLabel(range.start, range.end)}
          </h3>
          <p className="mt-1 text-sm text-white/45">
            Selected: {getWeekday(selectedKey)}, {formatDate(selectedKey)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {(["day", "week", "month"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onModeChange(item)}
              className={`rounded-xl px-3 py-2 text-sm font-semibold capitalize transition ${
                mode === item
                  ? "bg-orange-500 text-black"
                  : "border border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
              }`}
            >
              {item}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onNavigate("previous")}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white/70 hover:bg-white/10"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={onToday}
            className="rounded-xl border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-sm font-semibold text-orange-200 hover:bg-orange-500/15"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => onNavigate("next")}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white/70 hover:bg-white/10"
          >
            Next
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase tracking-wide text-white/40">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <div key={day} className="py-2">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((date) => {
          const dateKey = toDateKey(date);
          const eventCount = eventsByDate.get(dateKey) ?? 0;
          const inCurrentMonth = date.getMonth() === selectedDate.getMonth();
          const inSelectedRange = date >= range.start && date <= range.end;
          const isSelected = dateKey === selectedKey;

          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => onSelectDate(date)}
              className={`min-h-16 rounded-xl border p-2 text-left transition sm:min-h-20 ${
                isSelected
                  ? "border-orange-400 bg-orange-500 text-black"
                  : inSelectedRange
                    ? "border-orange-500/30 bg-orange-500/10 text-white"
                    : "border-white/10 bg-white/3 text-white hover:bg-white/10"
              } ${inCurrentMonth ? "" : "opacity-45"}`}
            >
              <span className="block text-sm font-semibold">
                {date.getDate()}
              </span>
              <span className="mt-1 block text-[11px]">
                {getWeekday(dateKey)}
              </span>
              {eventCount > 0 ? (
                <span
                  className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    isSelected
                      ? "bg-black/20 text-black"
                      : "bg-orange-500/20 text-orange-200"
                  }`}
                >
                  {eventCount} due
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FleetServiceCalendar({
  vehicles,
  schedules,
}: {
  vehicles: FleetVehicle[];
  schedules: FleetServiceSchedule[];
}) {
  const services = vehicles
    .map((vehicle) => {
      const source = getVehicleServiceSource(vehicle, schedules);
      return {
        vehicle,
        ...source,
        date: source.nextServiceDate,
      };
    })
    .filter((item) => Boolean(item.date))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .slice(0, 12);

  if (services.length === 0) {
    return (
      <EmptyState
        title="No upcoming services scheduled"
        message="Add service schedules or vehicle next-service dates to populate the service calendar."
      />
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {services.map((item) => {
        const { status, remainingKm } = getServiceStatus(
          item.vehicle.current_odometer_km,
          item.nextServiceOdo,
          item.nextServiceDate,
        );

        return (
          <div
            key={`${item.vehicle.id}-${item.date}`}
            className={`rounded-2xl border p-4 ${serviceCardClass(status)}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="rounded-xl border border-orange-500/20 bg-orange-500/10 px-3 py-2 text-center">
                <p className="text-xs font-semibold uppercase text-orange-200">
                  {getWeekday(item.date)}
                </p>
                <p className="text-lg font-bold text-white">
                  {getMonthDay(item.date)}
                </p>
              </div>
              <span
                className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${serviceBadgeClass(status)}`}
              >
                {serviceLabel(status)}
              </span>
            </div>
            <h3 className="mt-4 font-semibold text-white">
              {item.vehicle.vehicle_name ?? item.vehicle.registration_number ?? "Vehicle"}
            </h3>
            <p className="mt-1 text-xs text-white/45">
              {item.schedule?.service_type ?? "Routine service"} · next at{" "}
              {formatNumber(item.nextServiceOdo, 0)} km
            </p>
            <p className="mt-3 text-sm text-white/65">
              Remaining:{" "}
              <span
                className={
                  status === "overdue"
                    ? "font-semibold text-red-200"
                    : status === "soon"
                      ? "font-semibold text-orange-200"
                      : "text-white"
                }
              >
                {remainingKm === null
                  ? "-"
                  : `${formatNumber(Math.max(0, remainingKm), 0)} km`}
              </span>
            </p>
          </div>
        );
      })}
    </div>
  );
}

function ServiceHistoryTable({
  records,
}: {
  records: FleetMaintenanceRecord[];
}) {
  if (records.length === 0) {
    return (
      <EmptyState
        title="No service history yet"
        message="Service dates, odometer readings, mechanics, costs, notes and receipts will appear here."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-white/10">
          <thead className="bg-white/4">
            <tr>
              {[
                "Vehicle",
                "Service date",
                "Odometer",
                "Next service",
                "Vendor / mechanic",
                "Cost",
                "Notes",
                "Receipt",
              ].map((heading) => (
                <th
                  key={heading}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-white/45"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10 bg-black/20">
            {records.map((record) => (
              <tr key={record.id} className="hover:bg-white/3">
                <td className="px-4 py-4">
                  <p className="font-medium text-white">
                    {record.vehicle?.vehicle_name ?? "Unknown vehicle"}
                  </p>
                  <p className="mt-1 text-xs text-white/45">
                    {record.vehicle?.registration_number ?? record.service_type}
                  </p>
                </td>
                <td className="px-4 py-4 text-sm text-white/70">
                  <p>{formatDate(record.service_date)}</p>
                  <p className="text-xs text-white/40">
                    {getWeekday(record.service_date)} ·{" "}
                    {getMonthDay(record.service_date)}
                  </p>
                </td>
                <td className="px-4 py-4 text-sm text-white/70">
                  {formatNumber(record.odometer_km, 0)} km
                </td>
                <td className="px-4 py-4 text-sm text-white/70">
                  <p>{formatNumber(record.next_service_odometer_km, 0)} km</p>
                  <p className="text-xs text-white/40">
                    {formatDate(record.next_service_date)}
                  </p>
                </td>
                <td className="px-4 py-4 text-sm text-white/70">
                  {record.provider ?? "-"}
                </td>
                <td className="px-4 py-4 text-sm text-white/70">
                  {record.cost === null
                    ? "-"
                    : `${record.currency} ${formatNumber(record.cost, 2)}`}
                </td>
                <td className="max-w-xs px-4 py-4 text-sm text-white/60">
                  {record.description ?? "-"}
                </td>
                <td className="px-4 py-4 text-sm text-white/70">
                  {record.invoice_url ? (
                    <a
                      href={record.invoice_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-orange-300 transition hover:text-orange-200"
                    >
                      View file
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AddFuelPurchaseModal({
  vehicles,
  organizationId,
  userId,
  onClose,
  onCreated,
}: {
  vehicles: FleetVehicle[];
  organizationId: string;
  userId?: string | null;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [form, setForm] = useState<FuelPurchaseFormState>({
    vehicleId: vehicles[0]?.id ?? "",
    purchaseDate: new Date().toISOString().slice(0, 16),
    litres: "",
    totalCost: "",
    currency: "USD",
    odometerKm: "",
    stationName: "",
    paymentMethod: "",
    receiptNumber: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateField = (field: keyof FuelPurchaseFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const litres = Number(form.litres);
    const totalCost = Number(form.totalCost);
    const odometerKm = form.odometerKm ? Number(form.odometerKm) : null;

    if (!form.vehicleId) {
      setError("Choose a vehicle.");
      return;
    }

    if (!Number.isFinite(litres) || litres <= 0) {
      setError("Enter fuel litres greater than zero.");
      return;
    }

    if (!Number.isFinite(totalCost) || totalCost < 0) {
      setError("Enter a valid total cost.");
      return;
    }

    if (odometerKm !== null && (!Number.isFinite(odometerKm) || odometerKm < 0)) {
      setError("Enter a valid odometer reading.");
      return;
    }

    const payload: CreateFuelPurchaseInput = {
      organizationId,
      vehicleId: form.vehicleId,
      purchaseDate: new Date(form.purchaseDate).toISOString(),
      litres,
      totalCost,
      currency: form.currency || "USD",
      odometerKm,
      stationName: form.stationName,
      paymentMethod: form.paymentMethod,
      receiptNumber: form.receiptNumber,
      recordedBy: userId ?? null,
      notes: form.notes,
    };

    try {
      setSaving(true);
      await createFuelPurchase(payload);
      await onCreated();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to record fuel purchase.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-neutral-950 shadow-2xl shadow-black">
        <div className="border-b border-white/10 p-5">
          <h2 className="text-xl font-semibold text-white">
            Add fuel purchase
          </h2>
          <p className="mt-1 text-sm text-white/45">
            Record real fuel bought. EziTrack consumption stays separate.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-5">
          {error ? (
            <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
              {error}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-white/40">
                Vehicle
              </span>
              <select
                value={form.vehicleId}
                onChange={(event) => updateField("vehicleId", event.target.value)}
                className={selectClassName()}
              >
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.vehicle_name ?? vehicle.registration_number ?? vehicle.id}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-white/40">
                Purchase date
              </span>
              <input
                type="datetime-local"
                value={form.purchaseDate}
                onChange={(event) =>
                  updateField("purchaseDate", event.target.value)
                }
                className={inputClassName()}
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-white/40">
                Litres
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.litres}
                onChange={(event) => updateField("litres", event.target.value)}
                placeholder="40.00"
                className={inputClassName()}
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-white/40">
                Total cost
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.totalCost}
                onChange={(event) => updateField("totalCost", event.target.value)}
                placeholder="64.00"
                className={inputClassName()}
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-white/40">
                Currency
              </span>
              <input
                value={form.currency}
                onChange={(event) => updateField("currency", event.target.value)}
                className={inputClassName()}
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-white/40">
                Odometer
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.odometerKm}
                onChange={(event) => updateField("odometerKm", event.target.value)}
                placeholder="83972"
                className={inputClassName()}
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-white/40">
                Station
              </span>
              <input
                value={form.stationName}
                onChange={(event) =>
                  updateField("stationName", event.target.value)
                }
                placeholder="Puma Avondale"
                className={inputClassName()}
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-white/40">
                Payment method
              </span>
              <input
                value={form.paymentMethod}
                onChange={(event) =>
                  updateField("paymentMethod", event.target.value)
                }
                placeholder="Cash, card, account"
                className={inputClassName()}
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-white/40">
                Receipt number
              </span>
              <input
                value={form.receiptNumber}
                onChange={(event) =>
                  updateField("receiptNumber", event.target.value)
                }
                placeholder="Optional"
                className={inputClassName()}
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-white/40">
                Notes
              </span>
              <textarea
                value={form.notes}
                onChange={(event) => updateField("notes", event.target.value)}
                rows={3}
                placeholder="Optional context"
                className={inputClassName()}
              />
            </label>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/5 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || vehicles.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Save fuel purchase
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
function AddServiceRecordModal({
  vehicles,
  summaries,
  organizationId,
  userId,
  onClose,
  onCreated,
}: {
  vehicles: FleetVehicle[];
  summaries: FleetDailySummary[];
  organizationId: string;
  userId?: string | null;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [form, setForm] = useState<MaintenanceFormState>({
    vehicleId: vehicles[0]?.id ?? "",
    serviceDate: toDateKey(new Date()),
    odometerKm: "",
    serviceType: "Routine service",
    nextServiceDate: "",
    nextServiceOdometerKm: "",
    provider: "",
    cost: "",
    currency: "USD",
    receiptUrl: "",
    notes: "",
  });

  const [dateManuallyEdited, setDateManuallyEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === form.vehicleId) ?? null,
    [form.vehicleId, vehicles],
  );

  const latestOdometerKm = selectedVehicle
    ? getLatestVehicleOdometer(selectedVehicle, summaries)
    : null;

  const averageDailyKm = selectedVehicle
    ? getAverageDailyKm(selectedVehicle.id, summaries)
    : null;

  const autoNextServiceDate = useMemo(() => {
    const nextServiceOdometerKm = form.nextServiceOdometerKm
      ? Number(form.nextServiceOdometerKm)
      : null;

    return calculateEstimatedNextServiceDate({
      vehicleId: form.vehicleId,
      serviceDate: form.serviceDate,
      serviceOdometerKm: latestOdometerKm,
      nextServiceOdometerKm,
      summaries,
    });
  }, [
    form.nextServiceOdometerKm,
    form.serviceDate,
    form.vehicleId,
    latestOdometerKm,
    summaries,
  ]);

  useEffect(() => {
    if (!dateManuallyEdited && autoNextServiceDate) {
      setForm((current) => ({
        ...current,
        nextServiceDate: autoNextServiceDate,
      }));
    }
  }, [autoNextServiceDate, dateManuallyEdited]);

  const updateField = (field: keyof MaintenanceFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const odometerKm = latestOdometerKm;
    const cost = form.cost ? Number(form.cost) : null;
    const nextServiceOdometerKm = form.nextServiceOdometerKm
      ? Number(form.nextServiceOdometerKm)
      : null;

    if (!form.vehicleId) {
      setError("Choose a vehicle.");
      return;
    }

    if (!form.serviceDate) {
      setError("Choose a service date.");
      return;
    }

    if (odometerKm === null || !Number.isFinite(Number(odometerKm))) {
      setError(
        "This vehicle has no imported/current odometer yet. Import EziTrack data first or update the vehicle odometer.",
      );
      return;
    }

    if (
      nextServiceOdometerKm === null ||
      !Number.isFinite(nextServiceOdometerKm) ||
      nextServiceOdometerKm <= Number(odometerKm)
    ) {
      setError(
        "Enter a next service odometer greater than the current odometer.",
      );
      return;
    }

    if (cost !== null && (!Number.isFinite(cost) || cost < 0)) {
      setError("Enter a valid service cost.");
      return;
    }

    const payload: CreateMaintenanceRecordInput = {
      organizationId,
      vehicleId: form.vehicleId,
      serviceDate: form.serviceDate,
      odometerKm: Number(odometerKm),
      serviceType: form.serviceType,
      nextServiceDate: form.nextServiceDate || autoNextServiceDate || null,
      nextServiceOdometerKm,
      provider: form.provider,
      cost,
      currency: form.currency || "USD",
      receiptUrl: form.receiptUrl,
      notes: form.notes,
      createdBy: userId ?? null,
    };

    try {
      setSaving(true);
      await createMaintenanceRecord(payload);
      await onCreated();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to record service history.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-neutral-950 shadow-2xl shadow-black">
        <div className="border-b border-white/10 p-5">
          <h2 className="text-xl font-semibold text-white">
            Add service record
          </h2>
          <p className="mt-1 text-sm text-white/45">
            The current odometer is pulled from the latest EziTrack/current
            vehicle reading. Enter the next service odometer and the date will
            be estimated automatically.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-5">
          {error ? (
            <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
              {error}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-white/40">
                Vehicle
              </span>
              <select
                value={form.vehicleId}
                onChange={(event) => {
                  setDateManuallyEdited(false);
                  updateField("vehicleId", event.target.value);
                }}
                className={selectClassName()}
              >
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.vehicle_name ??
                      vehicle.registration_number ??
                      vehicle.id}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-white/40">
                Service date
              </span>
              <input
                type="date"
                value={form.serviceDate}
                onChange={(event) => {
                  setDateManuallyEdited(false);
                  updateField("serviceDate", event.target.value);
                }}
                className={inputClassName()}
              />
            </label>

            <div className="rounded-xl border border-white/10 bg-black p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/40">
                Current odometer
              </p>
              <p className="mt-2 text-lg font-semibold text-white">
                {formatNumber(latestOdometerKm, 0)} km
              </p>
              <p className="mt-1 text-xs text-white/40">
                Pulled from latest EziTrack/current vehicle reading
              </p>
            </div>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-white/40">
                Next service odometer
              </span>
              <input
                type="number"
                min="0"
                step="1"
                value={form.nextServiceOdometerKm}
                onChange={(event) => {
                  setDateManuallyEdited(false);
                  updateField("nextServiceOdometerKm", event.target.value);
                }}
                placeholder={
                  latestOdometerKm
                    ? String(Math.round(Number(latestOdometerKm) + 10000))
                    : "Next service km"
                }
                className={inputClassName()}
              />
            </label>

            <div className="rounded-xl border border-orange-500/20 bg-orange-500/10 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-200/70">
                Estimated next service date
              </p>
              <p className="mt-2 text-lg font-semibold text-white">
                {form.nextServiceDate
                  ? formatDate(form.nextServiceDate)
                  : "Not enough EziTrack data"}
              </p>
              <p className="mt-1 text-xs text-orange-100/60">
                {averageDailyKm
                  ? `Based on about ${formatNumber(averageDailyKm, 1)} km/day`
                  : "Needs at least two EziTrack odometer readings"}
              </p>
            </div>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-white/40">
                Override next service date
              </span>
              <input
                type="date"
                value={form.nextServiceDate}
                onChange={(event) => {
                  setDateManuallyEdited(true);
                  updateField("nextServiceDate", event.target.value);
                }}
                className={inputClassName()}
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-white/40">
                Vendor / mechanic
              </span>
              <input
                value={form.provider}
                onChange={(event) =>
                  updateField("provider", event.target.value)
                }
                className={inputClassName()}
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-white/40">
                Cost
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.cost}
                onChange={(event) => updateField("cost", event.target.value)}
                className={inputClassName()}
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-white/40">
                Currency
              </span>
              <input
                value={form.currency}
                onChange={(event) =>
                  updateField("currency", event.target.value)
                }
                className={inputClassName()}
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-white/40">
                Invoice/file URL
              </span>
              <input
                value={form.receiptUrl}
                onChange={(event) =>
                  updateField("receiptUrl", event.target.value)
                }
                placeholder="Optional storage URL"
                className={inputClassName()}
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-white/40">
                Notes
              </span>
              <textarea
                value={form.notes}
                onChange={(event) => updateField("notes", event.target.value)}
                rows={3}
                className={inputClassName()}
              />
            </label>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/5 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || vehicles.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Plus size={16} />
              )}
              Save service record
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FleetSummaryTable({ summaries }: { summaries: FleetDailySummary[] }) {
  if (summaries.length === 0) {
    return (
      <EmptyState
        title="No fleet summaries yet"
        message="Once the EziTrack import runs, daily vehicle summaries will appear here."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-white/10">
          <thead className="bg-white/4">
            <tr>
              {[
                "Vehicle",
                "Date",
                "Route",
                "Fuel",
                "Top speed",
                "Move / Stop",
                "Odometer",
              ].map((heading) => (
                <th
                  key={heading}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-white/45"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10 bg-black/20">
            {summaries.map((summary) => (
              <tr key={summary.id} className="hover:bg-white/3">
                <td className="px-4 py-4">
                  <p className="font-medium text-white">
                    {summary.vehicle?.vehicle_name ?? "Unknown vehicle"}
                  </p>
                  <p className="mt-1 text-xs text-white/45">
                    {summary.vehicle?.registration_number ?? summary.source}
                  </p>
                </td>
                <td className="px-4 py-4 text-sm text-white/70">
                  {formatDate(summary.summary_date)}
                </td>
                <td className="px-4 py-4 text-sm text-white/70">
                  {formatNumber(summary.route_length_km, 2)} km
                </td>
                <td className="px-4 py-4 text-sm text-white/70">
                  <p>{formatNumber(summary.fuel_consumption_litres, 2)} L</p>
                  <p className="text-xs text-white/40">
                    {summary.fuel_cost === null
                      ? "-"
                      : `${summary.currency} ${formatNumber(summary.fuel_cost, 2)}`}
                  </p>
                </td>
                <td className="px-4 py-4 text-sm text-white/70">
                  {formatNumber(summary.top_speed_kmh, 0)} kph
                </td>
                <td className="px-4 py-4 text-sm text-white/70">
                  <p>{formatDuration(summary.move_duration_seconds)} moving</p>
                  <p className="text-xs text-white/40">
                    {formatDuration(summary.stop_duration_seconds)} stopped
                  </p>
                </td>
                <td className="px-4 py-4 text-sm text-white/70">
                  {formatNumber(summary.odometer_km, 0)} km
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ImportBatchList({
  batches,
  rows,
}: {
  batches: FleetImportBatch[];
  rows: FleetImportRow[];
}) {
  if (batches.length === 0) {
    return (
      <EmptyState
        title="No import batches yet"
        message="Import attempts from n8n will be logged here with row-level results."
      />
    );
  }

  const rowsByBatch = rows.reduce<Record<string, FleetImportRow[]>>(
    (accumulator, row) => {
      accumulator[row.batch_id] = accumulator[row.batch_id] ?? [];
      accumulator[row.batch_id].push(row);
      return accumulator;
    },
    {},
  );

  return (
    <div className="space-y-3">
      {batches.map((batch) => {
        const batchRows = rowsByBatch[batch.id] ?? [];
        const failedRows = batchRows.filter((row) => row.status !== "imported");

        return (
          <div
            key={batch.id}
            className="rounded-2xl border border-white/10 bg-white/4 p-5"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge status={batch.status} />
                  <p className="text-sm text-white/45">
                    {formatDateTime(batch.created_at)}
                  </p>
                </div>
                <h3 className="mt-3 truncate text-base font-semibold text-white">
                  {batch.file_name ?? "EziTrack daily report"}
                </h3>
                <p className="mt-1 text-sm text-white/45">
                  {batch.imported_rows}/{batch.total_rows} imported,{" "}
                  {batch.failed_rows} failed
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-sm lg:min-w-64">
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="text-white">{batch.total_rows}</p>
                  <p className="text-xs text-white/40">Rows</p>
                </div>
                <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3">
                  <p className="text-emerald-200">{batch.imported_rows}</p>
                  <p className="text-xs text-emerald-100/50">Imported</p>
                </div>
                <div className="rounded-xl border border-red-400/20 bg-red-500/10 p-3">
                  <p className="text-red-200">{batch.failed_rows}</p>
                  <p className="text-xs text-red-100/50">Failed</p>
                </div>
              </div>
            </div>

            {failedRows.length > 0 ? (
              <div className="mt-4 space-y-2">
                {failedRows.map((row) => (
                  <div
                    key={row.id}
                    className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={row.status} />
                      <p className="text-sm font-medium text-white">
                        Row {row.row_number}
                      </p>
                    </div>
                    <p className="mt-2 text-sm text-red-100/75">
                      {row.error_message ?? "Import row failed."}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default function FleetDashboardPage() {
  const auth = useAuth();
  const location = useLocation();
  const autoNotificationKeys = useRef(new Set<string>());
  const [data, setData] = useState<FleetDashboardData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [dateRange, setDateRange] = useState<DateRangeFilter>("30d");
  const [calendarRange, setCalendarRange] = useState(() => {
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const start = addDays(end, -30);

    return {
      startDate: toDateKey(start),
      endDate: toDateKey(end),
    };
  });
  const [importStatusFilter, setImportStatusFilter] =
    useState<ImportStatusFilter>("all");
  const [fuelModalOpen, setFuelModalOpen] = useState(false);
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [selectedServiceDate, setSelectedServiceDate] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [serviceCalendarMode, setServiceCalendarMode] =
    useState<ServiceCalendarMode>("month");
  const [vehicleStatusFilter, setVehicleStatusFilter] =
    useState<VehicleStatusFilter>("all");
  const [officeFilter, setOfficeFilter] = useState("all");
  const [fleetSortMode, setFleetSortMode] =
    useState<FleetSortMode>("next-service");
  const [notifyingFleet, setNotifyingFleet] = useState(false);

  const organizationId = auth.profile?.organization_id ?? null;
  const showingImports = location.pathname.startsWith("/fleet/imports");
  const showingFuelPurchases =
    location.pathname.startsWith("/fleet/fuel-purchases");
  const showingService = location.pathname.startsWith("/fleet/service");
  const fleetDateRange = useMemo<FleetDashboardDateRange>(() => {
    if (dateRange === "custom") {
      return {
        mode: "fixed",
        startDate: calendarRange.startDate,
        endDate: calendarRange.endDate,
      };
    }

    return getFleetDateRange(dateRange);
  }, [calendarRange.endDate, calendarRange.startDate, dateRange]);

  const loadFleetData = useCallback(async () => {
    if (!organizationId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await fetchFleetDashboardData(organizationId, fleetDateRange);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load fleet data.");
    } finally {
      setLoading(false);
    }
  }, [fleetDateRange, organizationId]);

  useEffect(() => {
    void loadFleetData();
  }, [loadFleetData]);

  useEffect(() => {
    if (!organizationId || loading || data.vehicles.length === 0) return;

    const candidates = data.vehicles
      .map((vehicle) => {
        const service = getVehicleServiceSource(vehicle, data.serviceSchedules);
        const result = getServiceStatus(
          vehicle.current_odometer_km,
          service.nextServiceOdo,
          service.nextServiceDate,
        );

        return { vehicle, service, ...result };
      })
      .filter((item) => item.status === "overdue" || item.status === "soon")
      .filter((item) => {
        const key = `${organizationId}:${item.vehicle.id}:${item.status}`;
        if (autoNotificationKeys.current.has(key)) return false;
        autoNotificationKeys.current.add(key);
        return true;
      });

    if (candidates.length === 0) return;

    void Promise.all(
      candidates.map((item) =>
        notifyFleetServiceStatus({
          organizationId,
          vehicleId: item.vehicle.id,
          vehicleLabel:
            item.vehicle.vehicle_name ??
            item.vehicle.registration_number ??
            "Vehicle",
          status: item.status === "overdue" ? "overdue" : "soon",
          remainingKm: item.remainingKm ?? 0,
          nextServiceOdo: item.service.nextServiceOdo,
        }),
      ),
    ).catch((err) => {
      console.error("AUTO FLEET SERVICE NOTIFICATION ERROR:", err);
    });
  }, [data.serviceSchedules, data.vehicles, loading, organizationId]);

  const filteredSummaries = useMemo(
    () =>
      data.summaries.filter((summary) => {
        const vehicleMatches =
          vehicleFilter === "all" || summary.vehicle_id === vehicleFilter;
        return vehicleMatches && isWithinRange(summary, fleetDateRange);
      }),
    [data.summaries, fleetDateRange, vehicleFilter],
  );

  const filteredBatches = useMemo(
    () =>
      data.batches.filter((batch) => {
        if (importStatusFilter === "all") return true;
        if (importStatusFilter === "completed") return batch.status === "completed";
        return batch.status === "failed" || batch.status === "partial_failed";
      }),
    [data.batches, importStatusFilter],
  );

  const filteredBatchIds = useMemo(
    () => new Set(filteredBatches.map((batch) => batch.id)),
    [filteredBatches],
  );

  const filteredRows = useMemo(
    () => data.rows.filter((row) => filteredBatchIds.has(row.batch_id)),
    [data.rows, filteredBatchIds],
  );

  const chartData = useMemo(
    () => buildChartData(filteredSummaries),
    [filteredSummaries],
  );

  const duplicateLabels = useMemo(() => {
    const counts = new Map<string, number>();

    for (const vehicle of data.vehicles) {
      const nameKey = normalizeKey(vehicle.vehicle_name);
      const registrationKey = normalizeKey(vehicle.registration_number);

      if (nameKey) counts.set(`name:${nameKey}`, (counts.get(`name:${nameKey}`) ?? 0) + 1);
      if (registrationKey) {
        counts.set(
          `registration:${registrationKey}`,
          (counts.get(`registration:${registrationKey}`) ?? 0) + 1,
        );
      }
    }

    const labels = new Set<string>();
    for (const vehicle of data.vehicles) {
      const nameKey = normalizeKey(vehicle.vehicle_name);
      const registrationKey = normalizeKey(vehicle.registration_number);

      if (nameKey && (counts.get(`name:${nameKey}`) ?? 0) > 1) {
        labels.add(vehicle.vehicle_name ?? nameKey);
      }

      if (
        registrationKey &&
        (counts.get(`registration:${registrationKey}`) ?? 0) > 1
      ) {
        labels.add(vehicle.registration_number ?? registrationKey);
      }
    }

    return Array.from(labels);
  }, [data.vehicles]);

  const filteredFuelPurchases = useMemo(
    () =>
      data.fuelPurchases.filter(
        (purchase) =>
          vehicleFilter === "all" || purchase.vehicle_id === vehicleFilter,
      ),
    [data.fuelPurchases, vehicleFilter],
  );

  const serviceVehicles = useMemo(() => {
    const calendarRange = getServiceCalendarRange(
      selectedServiceDate,
      serviceCalendarMode,
    );
    const withService = data.vehicles
      .filter((vehicle) => vehicleFilter === "all" || vehicle.id === vehicleFilter)
      .filter((vehicle) => {
        const service = getVehicleServiceSource(vehicle, data.serviceSchedules);
        const { status } = getServiceStatus(
          vehicle.current_odometer_km,
          service.nextServiceOdo,
          service.nextServiceDate,
        );
        const vehicleStatus = String(vehicle.status ?? "active");
        const statusMatches =
          vehicleStatusFilter === "all" ||
          (vehicleStatusFilter === "maintenance"
            ? vehicleStatus === "maintenance" || vehicleStatus === "in_maintenance"
            : vehicleStatus === vehicleStatusFilter);
        const officeMatches =
          officeFilter === "all" ||
          vehicle.office_id === officeFilter ||
          vehicle.office?.id === officeFilter;
        const dueInCalendarRange = isDateInRange(
          service.nextServiceDate,
          calendarRange.start,
          calendarRange.end,
        );
        const needsServiceWithoutDate = !service.nextServiceDate && status !== "ok";

        return (
          statusMatches &&
          officeMatches &&
          (dueInCalendarRange || needsServiceWithoutDate)
        );
      });

    return withService.slice().sort((a, b) => {
      const serviceA = getVehicleServiceSource(a, data.serviceSchedules);
      const serviceB = getVehicleServiceSource(b, data.serviceSchedules);

      if (fleetSortMode === "next-service") {
        return String(serviceA.nextServiceDate ?? "9999-12-31").localeCompare(
          String(serviceB.nextServiceDate ?? "9999-12-31"),
        );
      }

      if (fleetSortMode === "last-service") {
        return String(serviceB.lastServiceDate ?? "0000-01-01").localeCompare(
          String(serviceA.lastServiceDate ?? "0000-01-01"),
        );
      }

      if (fleetSortMode === "oldest") {
        return String(a.created_at ?? a.id).localeCompare(
          String(b.created_at ?? b.id),
        );
      }

      return String(b.created_at ?? b.id).localeCompare(
        String(a.created_at ?? a.id),
      );
    });
  }, [
    data.serviceSchedules,
    data.vehicles,
    fleetSortMode,
    officeFilter,
    selectedServiceDate,
    serviceCalendarMode,
    vehicleStatusFilter,
    vehicleFilter,
  ]);

  const serviceCalendarRange = useMemo(
    () => getServiceCalendarRange(selectedServiceDate, serviceCalendarMode),
    [selectedServiceDate, serviceCalendarMode],
  );

  const fleetOfficeOptions = useMemo(() => {
    const offices = new Map<string, string>();
    for (const vehicle of data.vehicles) {
      if (vehicle.office_id && vehicle.office?.name) {
        offices.set(vehicle.office_id, vehicle.office.name);
      }
    }
    return Array.from(offices.entries()).map(([id, name]) => ({ id, name }));
  }, [data.vehicles]);

  const filteredMaintenanceRecords = useMemo(
    () =>
      data.maintenanceRecords.filter(
        (record) =>
          vehicleFilter === "all" || record.vehicle_id === vehicleFilter,
      ),
    [data.maintenanceRecords, vehicleFilter],
  );

  const serviceCounts = useMemo(() => {
    let overdue = 0;
    let soon = 0;
    let ok = 0;
    let maintenance = 0;

    for (const vehicle of data.vehicles) {
      const service = getVehicleServiceSource(vehicle, data.serviceSchedules);
      const { status } = getServiceStatus(
        vehicle.current_odometer_km,
        service.nextServiceOdo,
        service.nextServiceDate,
      );

      if (status === "overdue") overdue++;
      if (status === "soon") soon++;
      if (status === "ok") ok++;
      if (vehicle.status === "maintenance" || vehicle.status === "in_maintenance") {
        maintenance++;
      }
    }

    return {
      total: data.vehicles.length,
      overdue,
      soon,
      ok,
      maintenance,
    };
  }, [data.serviceSchedules, data.vehicles]);

  async function handleNotifyFleetAdmins() {
    if (!organizationId) return;

    const candidates = data.vehicles
      .map((vehicle) => {
        const service = getVehicleServiceSource(vehicle, data.serviceSchedules);
        const result = getServiceStatus(
          vehicle.current_odometer_km,
          service.nextServiceOdo,
          service.nextServiceDate,
        );

        return {
          vehicle,
          service,
          ...result,
        };
      })
      .filter((item) => item.status === "overdue" || item.status === "soon");

    if (candidates.length === 0) {
      setError("No overdue or soon service alerts to send.");
      return;
    }

    try {
      setNotifyingFleet(true);
      setError(null);
      await Promise.all(
        candidates.map((item) =>
          notifyFleetServiceStatus({
            organizationId,
            vehicleId: item.vehicle.id,
            vehicleLabel:
              item.vehicle.vehicle_name ??
              item.vehicle.registration_number ??
              "Vehicle",
            status: item.status === "overdue" ? "overdue" : "soon",
            remainingKm: item.remainingKm ?? 0,
            nextServiceOdo: item.service.nextServiceOdo,
          }),
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to notify fleet administrators.",
      );
    } finally {
      setNotifyingFleet(false);
    }
  }

  const metrics = useMemo(() => {
    const latestByVehicle = new Map<string, FleetDailySummary>();

    for (const summary of filteredSummaries) {
      if (!latestByVehicle.has(summary.vehicle_id)) {
        latestByVehicle.set(summary.vehicle_id, summary);
      }
    }

    const latest = Array.from(latestByVehicle.values());
    const completedImports = data.batches.filter(
      (batch) => batch.status === "completed",
    ).length;
    const failedImports = data.batches.filter(
      (batch) => batch.status === "failed" || batch.status === "partial_failed",
    ).length;

    return {
      vehicles: latest.length,
      routeKm: filteredSummaries.reduce(
        (total, summary) => total + summary.route_length_km,
        0,
      ),
      fuelLitres: filteredSummaries.reduce(
        (total, summary) => total + Number(summary.fuel_consumption_litres ?? 0),
        0,
      ),
      latestOdometer: latest.reduce(
        (total, summary) => total + Number(summary.odometer_km ?? 0),
        0,
      ),
      completedImports,
      failedImports,
      fuelPurchasedLitres: filteredFuelPurchases.reduce(
        (total, purchase) => total + purchase.litres,
        0,
      ),
      fuelPurchasedCost: filteredFuelPurchases.reduce(
        (total, purchase) => total + purchase.total_cost,
        0,
      ),
    };
  }, [data.batches, filteredFuelPurchases, filteredSummaries]);

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <Sidebar role={auth.profile?.primary_role ?? null} />

      <main className="px-4 py-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-orange-300/70">
                Assets / Fleet
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
                Fleet Operations
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-white/50">
                Daily EziTrack summaries, import health, mileage, fuel and
                odometer data from the live fleet pipeline.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              {showingFuelPurchases ? (
                <button
                  type="button"
                  onClick={() => setFuelModalOpen(true)}
                  disabled={data.vehicles.length === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Plus size={16} />
                  Add fuel purchase
                </button>
              ) : null}

              {showingService ? (
                <button
                  type="button"
                  onClick={() => setServiceModalOpen(true)}
                  disabled={data.vehicles.length === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Plus size={16} />
                  Add service record
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => void loadFleetData()}
                disabled={loading || !organizationId}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <RefreshCw size={16} />
                )}
                Refresh
              </button>
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
              {error}
            </div>
          ) : null}

          <DuplicateVehicleWarning duplicateLabels={duplicateLabels} />

          <div className="rounded-2xl border border-white/10 bg-black p-4">
            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-white/40">
                  Vehicle
                </span>
                <select
                  value={vehicleFilter}
                  onChange={(event) => setVehicleFilter(event.target.value)}
                  className={selectClassName()}
                >
                  <option value="all">All vehicles</option>
                  {data.vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.vehicle_name ?? vehicle.registration_number ?? vehicle.id}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-white/40">
                  Date range
                </span>
                <select
                  value={dateRange}
                  onChange={(event) =>
                    setDateRange(event.target.value as DateRangeFilter)
                  }
                  className={selectClassName()}
                >
                  <option value="day">Day</option>
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="custom">Calendar range</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-white/40">
                  Import status
                </span>
                <select
                  value={importStatusFilter}
                  onChange={(event) =>
                    setImportStatusFilter(event.target.value as ImportStatusFilter)
                  }
                  className={selectClassName()}
                >
                  <option value="all">All batches</option>
                  <option value="completed">Completed only</option>
                  <option value="attention">Needs attention</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-white/40">
                  Vehicle status
                </span>
                <select
                  value={vehicleStatusFilter}
                  onChange={(event) =>
                    setVehicleStatusFilter(event.target.value as VehicleStatusFilter)
                  }
                  className={selectClassName()}
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="maintenance">In maintenance</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-white/40">
                  Office
                </span>
                <select
                  value={officeFilter}
                  onChange={(event) => setOfficeFilter(event.target.value)}
                  className={selectClassName()}
                  disabled={fleetOfficeOptions.length === 0}
                >
                  <option value="all">
                    {fleetOfficeOptions.length === 0 ? "No office links" : "All offices"}
                  </option>
                  {fleetOfficeOptions.map((office) => (
                    <option key={office.id} value={office.id}>
                      {office.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-white/40">
                  Sort vehicles
                </span>
                <select
                  value={fleetSortMode}
                  onChange={(event) =>
                    setFleetSortMode(event.target.value as FleetSortMode)
                  }
                  className={selectClassName()}
                >
                  <option value="next-service">Next service due</option>
                  <option value="last-service">Last service date</option>
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                </select>
              </label>
            </div>
          </div>

          <FleetDateRangeCalendar
            startDate={calendarRange.startDate}
            endDate={calendarRange.endDate}
            onChange={setCalendarRange}
            onUseCalendarRange={() => setDateRange("custom")}
          />

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              label="Total Vehicles"
              value={formatNumber(serviceCounts.total)}
              helper="Fleet records in this organization"
              icon={<Truck size={20} />}
            />
            <MetricCard
              label="Service Overdue"
              value={formatNumber(serviceCounts.overdue)}
              helper="Current odometer at or past service"
              icon={<AlertTriangle size={20} />}
            />
            <MetricCard
              label="Service Soon"
              value={formatNumber(serviceCounts.soon)}
              helper="Within 1,000 km"
              icon={<Clock3 size={20} />}
            />
            <MetricCard
              label="Service OK"
              value={formatNumber(serviceCounts.ok)}
              helper="No overdue or soon service flags"
              icon={<CheckCircle2 size={20} />}
            />
            <MetricCard
              label="In Maintenance"
              value={formatNumber(serviceCounts.maintenance)}
              helper="Vehicles marked maintenance"
              icon={<Wrench size={20} />}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black p-5">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="text-emerald-300" size={20} />
                <div>
                  <p className="text-sm text-white/50">Latest completed import</p>
                  <p className="text-lg font-semibold text-white">
                    {formatDateTime(
                      data.batches.find((batch) => batch.status === "completed")
                        ?.completed_at,
                    )}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black p-5">
              <div className="flex items-center gap-3">
                <Gauge className="text-orange-300" size={20} />
                <div>
                  <p className="text-sm text-white/50">Combined odometer</p>
                  <p className="text-lg font-semibold text-white">
                    {formatNumber(metrics.latestOdometer, 0)} km
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black p-5">
              <div className="flex items-center gap-3">
                {metrics.failedImports > 0 ? (
                  <AlertTriangle className="text-amber-300" size={20} />
                ) : (
                  <XCircle className="text-white/30" size={20} />
                )}
                <div>
                  <p className="text-sm text-white/50">Rows needing attention</p>
                  <p className="text-lg font-semibold text-white">
                    {
                      data.rows.filter((row) => row.status !== "imported")
                        .length
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>

          {!showingImports && !showingFuelPurchases && !showingService ? (
            <>
              <FleetTrendPanel chartData={chartData} />
              <FleetActivityGrid summaries={filteredSummaries} schedules={[]} />
            </>
          ) : null}

          {showingFuelPurchases ? (
            <LastRefuelGrid
              vehicles={data.vehicles}
              purchases={filteredFuelPurchases}
            />
          ) : null}

          {showingService ? (
            <>
              <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Service Tracking
                  </h2>
                  <p className="mt-1 text-sm text-white/45">
                    Showing services due {formatRangeLabel(serviceCalendarRange.start, serviceCalendarRange.end)}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleNotifyFleetAdmins()}
                  disabled={notifyingFleet}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-orange-500/20 bg-orange-500/10 px-4 py-3 text-sm font-semibold text-orange-200 hover:bg-orange-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {notifyingFleet ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Bell size={16} />
                  )}
                  Notify admins
                </button>
              </div>

              <FleetServiceDatePicker
                selectedDate={selectedServiceDate}
                mode={serviceCalendarMode}
                vehicles={data.vehicles}
                schedules={data.serviceSchedules}
                onSelectDate={setSelectedServiceDate}
                onModeChange={setServiceCalendarMode}
                onToday={() => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  setSelectedServiceDate(today);
                }}
                onNavigate={(direction) => {
                  const amount = direction === "next" ? 1 : -1;
                  setSelectedServiceDate((current) => {
                    if (serviceCalendarMode === "month") {
                      return addMonths(current, amount);
                    }
                    if (serviceCalendarMode === "week") {
                      return addDays(current, amount * 7);
                    }
                    return addDays(current, amount);
                  });
                }}
              />

              {serviceVehicles.length === 0 ? (
                <EmptyState
                  title="No services due for this calendar range"
                  message="Pick another day, week or month, or clear the vehicle/status/office filters."
                />
              ) : (
                <VehicleHealthGrid
                    vehicles={serviceVehicles}
                    schedules={data.serviceSchedules} summaries={[]}                />
              )}

              <FleetServiceCalendar
                vehicles={serviceVehicles}
                schedules={data.serviceSchedules}
              />
            </>
          ) : null}

          <div className="flex flex-wrap gap-2 border-b border-white/10">
            <Link
              to="/fleet"
              className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
                !showingImports && !showingFuelPurchases
                  && !showingService
                  ? "border-orange-500 text-white"
                  : "border-transparent text-white/45 hover:text-white"
              }`}
            >
              <CalendarDays size={16} />
              Daily summaries
            </Link>
            <Link
              to="/fleet/imports"
              className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
                showingImports
                  ? "border-orange-500 text-white"
                  : "border-transparent text-white/45 hover:text-white"
              }`}
            >
              <Clock3 size={16} />
              Import history
            </Link>
            <Link
              to="/fleet/fuel-purchases"
              className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
                showingFuelPurchases
                  ? "border-orange-500 text-white"
                  : "border-transparent text-white/45 hover:text-white"
              }`}
            >
              <Fuel size={16} />
              Fuel purchases
            </Link>
            <Link
              to="/fleet/service"
              className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
                showingService
                  ? "border-orange-500 text-white"
                  : "border-transparent text-white/45 hover:text-white"
              }`}
            >
              <Wrench size={16} />
              Service tracking
            </Link>
          </div>

          <section className="rounded-3xl border border-white/10 bg-black/70 p-4 shadow-2xl shadow-black/30 lg:p-6">
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  {showingFuelPurchases
                    ? "Fuel Purchases"
                    : showingImports
                      ? "Import History"
                      : showingService
                        ? "Service History"
                        : "Daily Fleet Summaries"}
                </h2>
                <p className="mt-1 text-sm text-white/45">
                  {showingFuelPurchases
                    ? "Real refuel events recorded by the team, separate from EziTrack consumption estimates."
                    : showingImports
                      ? "Every n8n import batch, including failed and unmatched rows."
                      : showingService
                        ? "Completed service records with odometer, cost, notes, vendor and receipt links."
                        : "Clean vehicle-day records imported from EziTrack reports."}
                </p>
              </div>
            </div>

            {loading ? (
              <div className="flex min-h-64 items-center justify-center text-white/60">
                <Loader2 className="mr-2 animate-spin" size={18} />
                Loading fleet data...
              </div>
            ) : showingFuelPurchases ? (
              <FuelPurchasesTable purchases={filteredFuelPurchases} />
            ) : showingImports ? (
              <ImportBatchList batches={filteredBatches} rows={filteredRows} />
            ) : showingService ? (
              <ServiceHistoryTable records={filteredMaintenanceRecords} />
            ) : (
              <FleetSummaryTable summaries={filteredSummaries} />
            )}
          </section>
        </div>
      </main>

      {fuelModalOpen && organizationId ? (
        <AddFuelPurchaseModal
          vehicles={data.vehicles}
          organizationId={organizationId}
          userId={auth.user?.id ?? null}
          onClose={() => setFuelModalOpen(false)}
          onCreated={loadFleetData}
        />
      ) : null}

      {serviceModalOpen && organizationId ? (
        <AddServiceRecordModal
          vehicles={data.vehicles}
          organizationId={organizationId}
          userId={auth.user?.id ?? null}
          onClose={() => setServiceModalOpen(false)}
          onCreated={loadFleetData} summaries={[]}        />
      ) : null}
    </div>
  );
}
