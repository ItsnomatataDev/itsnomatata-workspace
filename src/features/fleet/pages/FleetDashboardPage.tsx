import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  AlertTriangle,
  ArrowDownToLine,
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
  createFuelPurchase,
  fetchFleetDashboardData,
  type CreateFuelPurchaseInput,
  type FleetDashboardData,
  type FleetDashboardDateRange,
  type FleetDailySummary,
  type FleetFuelPurchase,
  type FleetImportBatch,
  type FleetImportRow,
  type FleetVehicle,
} from "../services/fleetService";

const EMPTY_DATA: FleetDashboardData = {
  vehicles: [],
  summaries: [],
  batches: [],
  rows: [],
  fuelPurchases: [],
};

type DateRangeFilter = "day" | "7d" | "30d";
type ImportStatusFilter = "all" | "completed" | "attention";
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
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-lg shadow-black/20">
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
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-8 text-center">
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

function getFleetDateRange(range: DateRangeFilter): FleetDashboardDateRange {
  if (range === "day") {
    return { mode: "latest-import-day" };
  }

  const end = new Date();
  end.setHours(0, 0, 0, 0);

  const start = new Date(end);
  start.setDate(start.getDate() - (range === "7d" ? 7 : 30));

  return {
    mode: "fixed",
    startDate: toDateKey(start),
    endDate: toDateKey(end),
  };
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

function VehicleHealthGrid({ summaries }: { summaries: FleetDailySummary[] }) {
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
      {latest.map((summary) => (
        <div
          key={summary.vehicle_id}
          className="rounded-2xl border border-white/10 bg-black p-5"
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
            <StatusBadge status={summary.vehicle?.status ?? "active"} />
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 text-sm">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-white">{formatNumber(summary.route_length_km, 2)}</p>
              <p className="mt-1 text-xs text-white/40">km</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-white">
                {formatNumber(summary.fuel_consumption_litres, 2)}
              </p>
              <p className="mt-1 text-xs text-white/40">litres</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-white">{formatNumber(summary.odometer_km, 0)}</p>
              <p className="mt-1 text-xs text-white/40">odo</p>
            </div>
          </div>
        </div>
      ))}
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
          <thead className="bg-white/[0.04]">
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
              <tr key={purchase.id} className="hover:bg-white/[0.03]">
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
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-white">{formatNumber(latest.litres, 2)} L</p>
                    <p className="mt-1 text-xs text-white/40">Fuel bought</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
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
              <div className="mt-5 rounded-xl border border-dashed border-white/10 bg-white/[0.03] p-4">
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
          <thead className="bg-white/[0.04]">
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
              <tr key={summary.id} className="hover:bg-white/[0.03]">
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
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
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
  const [data, setData] = useState<FleetDashboardData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [dateRange, setDateRange] = useState<DateRangeFilter>("30d");
  const [importStatusFilter, setImportStatusFilter] =
    useState<ImportStatusFilter>("all");
  const [fuelModalOpen, setFuelModalOpen] = useState(false);

  const organizationId = auth.profile?.organization_id ?? null;
  const showingImports = location.pathname.startsWith("/fleet/imports");
  const showingFuelPurchases =
    location.pathname.startsWith("/fleet/fuel-purchases");
  const fleetDateRange = useMemo(() => getFleetDateRange(dateRange), [dateRange]);

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
            <div className="grid gap-3 md:grid-cols-3">
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
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
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
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              label="Tracked vehicles"
              value={formatNumber(metrics.vehicles)}
              helper="Vehicles with imported summaries"
              icon={<Truck size={20} />}
            />
            <MetricCard
              label="Route distance"
              value={`${formatNumber(metrics.routeKm, 2)} km`}
              helper="Across loaded summaries"
              icon={<Route size={20} />}
            />
            <MetricCard
              label="Fuel used"
              value={`${formatNumber(metrics.fuelLitres, 2)} L`}
              helper="Reported by EziTrack"
              icon={<Fuel size={20} />}
            />
            <MetricCard
              label="Fuel bought"
              value={`${formatNumber(metrics.fuelPurchasedLitres, 2)} L`}
              helper={`USD ${formatNumber(metrics.fuelPurchasedCost, 2)} recorded`}
              icon={<Plus size={20} />}
            />
            <MetricCard
              label="Import health"
              value={`${metrics.completedImports}/${data.batches.length}`}
              helper={`${metrics.failedImports} batch(es) need attention`}
              icon={<ArrowDownToLine size={20} />}
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

          {!showingImports && !showingFuelPurchases ? (
            <>
              <FleetTrendPanel chartData={chartData} />
              <VehicleHealthGrid summaries={filteredSummaries} />
            </>
          ) : null}

          {showingFuelPurchases ? (
            <LastRefuelGrid
              vehicles={data.vehicles}
              purchases={filteredFuelPurchases}
            />
          ) : null}

          <div className="flex flex-wrap gap-2 border-b border-white/10">
            <Link
              to="/fleet"
              className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
                !showingImports && !showingFuelPurchases
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
          </div>

          <section className="rounded-3xl border border-white/10 bg-black/70 p-4 shadow-2xl shadow-black/30 lg:p-6">
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  {showingFuelPurchases
                    ? "Fuel Purchases"
                    : showingImports
                      ? "Import History"
                      : "Daily Fleet Summaries"}
                </h2>
                <p className="mt-1 text-sm text-white/45">
                  {showingFuelPurchases
                    ? "Real refuel events recorded by the team, separate from EziTrack consumption estimates."
                    : showingImports
                      ? "Every n8n import batch, including failed and unmatched rows."
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
    </div>
  );
}
