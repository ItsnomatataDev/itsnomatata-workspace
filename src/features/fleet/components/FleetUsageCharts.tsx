import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { Gauge, Fuel } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const CHART_COLORS = [
  "#f97316",
  "#38bdf8",
  "#a78bfa",
  "#34d399",
  "#f472b6",
  "#facc15",
  "#fb7185",
  "#22d3ee",
  "#c084fc",
  "#4ade80",
];

export type FleetVehicleChartSeries = {
  vehicleId: string;
  name: string;
  mileageKey: string;
  fuelKey: string;
  color: string;
};

export type FleetPerVehicleChartPoint = {
  label: string;
  date: string;
  [metricKey: string]: string | number;
};

function formatKm(value: number) {
  return `${Number(value || 0).toFixed(1)} km`;
}

function formatLitres(value: number) {
  return `${Number(value || 0).toFixed(1)} L`;
}

function seriesHasMileage(
  data: FleetPerVehicleChartPoint[],
  series: FleetVehicleChartSeries[],
) {
  return data.some((point) =>
    series.some((item) => Number(point[item.mileageKey] ?? 0) > 0),
  );
}

function seriesHasFuel(
  data: FleetPerVehicleChartPoint[],
  series: FleetVehicleChartSeries[],
) {
  return data.some((point) =>
    series.some((item) => Number(point[item.fuelKey] ?? 0) > 0),
  );
}

function PerVehicleTooltip({
  active,
  payload,
  label,
  series,
  unit,
}: {
  active?: boolean;
  payload?: Array<{
    dataKey?: string;
    value?: number;
    color?: string;
    payload?: FleetPerVehicleChartPoint;
  }>;
  label?: string;
  series: FleetVehicleChartSeries[];
  unit: "km" | "L";
}) {
  if (!active || !payload?.length) return null;

  const point = payload[0]?.payload as FleetPerVehicleChartPoint | undefined;
  const heading = point?.date ?? label ?? "";

  const rows = series
    .map((item) => {
      const entry = payload.find((row) => row.dataKey === item.mileageKey || row.dataKey === item.fuelKey);
      const value = Number(entry?.value ?? 0);
      if (value <= 0) return null;
      return { ...item, value };
    })
    .filter(Boolean) as Array<FleetVehicleChartSeries & { value: number }>;

  if (rows.length === 0) return null;

  return (
    <div
      className="rounded-lg border border-white/10 bg-[#050505] px-3 py-2 text-xs text-white shadow-lg"
      style={{ minWidth: 160 }}
    >
      <p className="mb-2 font-semibold text-white/90">{heading}</p>
      <ul className="space-y-1">
        {rows.map((row) => (
          <li key={row.vehicleId} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-white/75">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: row.color }}
              />
              <span className="max-w-[140px] truncate">{row.name}</span>
            </span>
            <span className="font-medium text-white">
              {unit === "km" ? formatKm(row.value) : formatLitres(row.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function buildFleetPerVehicleChartData(input: {
  summaries: Array<{
    vehicle_id: string;
    summary_date: string;
    route_length_km: number;
    fuel_consumption_litres: number | null;
    vehicle?: { vehicle_name?: string | null; registration_number?: string | null } | null;
  }>;
  fuelPurchases: Array<{
    vehicle_id: string;
    purchase_date: string;
    litres: number;
    vehicle?: { vehicle_name?: string | null; registration_number?: string | null } | null;
  }>;
  vehicles: Array<{
    id: string;
    vehicle_name?: string | null;
    registration_number?: string | null;
  }>;
  vehicleLabel: (vehicle?: {
    vehicle_name?: string | null | undefined;
    registration_number?: string | null | undefined;
  } | null) => string;
}): {
  data: FleetPerVehicleChartPoint[];
  series: FleetVehicleChartSeries[];
} {
  const vehicleMeta = new Map<string, string>();

  for (const vehicle of input.vehicles) {
    vehicleMeta.set(vehicle.id, input.vehicleLabel(vehicle));
  }
  for (const summary of input.summaries) {
    if (!vehicleMeta.has(summary.vehicle_id)) {
      vehicleMeta.set(summary.vehicle_id, input.vehicleLabel(summary.vehicle));
    }
  }
  for (const purchase of input.fuelPurchases) {
    if (!vehicleMeta.has(purchase.vehicle_id)) {
      vehicleMeta.set(purchase.vehicle_id, input.vehicleLabel(purchase.vehicle));
    }
  }

  const series = [...vehicleMeta.entries()]
    .sort(([, a], [, b]) => a.localeCompare(b))
    .map(([vehicleId, name], index) => ({
      vehicleId,
      name,
      mileageKey: `mileage_${vehicleId}`,
      fuelKey: `fuel_${vehicleId}`,
      color: CHART_COLORS[index % CHART_COLORS.length],
    }));

  const dateKeys = new Set<string>();
  for (const summary of input.summaries) {
    dateKeys.add(summary.summary_date.slice(0, 10));
  }
  for (const purchase of input.fuelPurchases) {
    dateKeys.add(purchase.purchase_date.slice(0, 10));
  }

  const emptyMetrics = () => {
    const row: Record<string, number> = {};
    for (const item of series) {
      row[item.mileageKey] = 0;
      row[item.fuelKey] = 0;
    }
    return row;
  };

  const byDate = new Map<string, Record<string, number>>();
  for (const dateKey of [...dateKeys].sort()) {
    byDate.set(dateKey, emptyMetrics());
  }

  for (const summary of input.summaries) {
    const dateKey = summary.summary_date.slice(0, 10);
    const row = byDate.get(dateKey) ?? emptyMetrics();
    const mileageKey = `mileage_${summary.vehicle_id}`;
    const fuelKey = `fuel_${summary.vehicle_id}`;
    row[mileageKey] = (row[mileageKey] ?? 0) + (Number(summary.route_length_km) || 0);
    row[fuelKey] = (row[fuelKey] ?? 0) + (Number(summary.fuel_consumption_litres) || 0);
    byDate.set(dateKey, row);
  }

  for (const purchase of input.fuelPurchases) {
    const dateKey = purchase.purchase_date.slice(0, 10);
    const row = byDate.get(dateKey) ?? emptyMetrics();
    const fuelKey = `fuel_${purchase.vehicle_id}`;
    row[fuelKey] = (row[fuelKey] ?? 0) + (Number(purchase.litres) || 0);
    byDate.set(dateKey, row);
  }

  const data = [...byDate.entries()].map(([dateKey, metrics]) => ({
    label: format(parseISO(dateKey), "d MMM"),
    date: format(parseISO(dateKey), "d MMM yyyy"),
    ...metrics,
  }));

  const activeVehicleIds = new Set<string>();
  for (const metrics of byDate.values()) {
    for (const item of series) {
      if (
        (metrics[item.mileageKey] ?? 0) > 0 ||
        (metrics[item.fuelKey] ?? 0) > 0
      ) {
        activeVehicleIds.add(item.vehicleId);
      }
    }
  }

  return {
    data,
    series: series.filter((item) => activeVehicleIds.has(item.vehicleId)),
  };
}

export default function FleetUsageCharts({
  data,
  series,
}: {
  data: FleetPerVehicleChartPoint[];
  series: FleetVehicleChartSeries[];
}) {
  const hasMileage = useMemo(
    () => seriesHasMileage(data, series),
    [data, series],
  );
  const hasFuel = useMemo(() => seriesHasFuel(data, series), [data, series]);

  const legendFormatter = (value: string) => {
    const item = series.find((row) => row.mileageKey === value || row.fuelKey === value);
    return item?.name ?? value;
  };

  return (
    <section className="mb-6 grid gap-6 xl:grid-cols-2">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="mb-5 flex items-center gap-3">
          <span className="rounded-xl border border-orange-500/20 bg-orange-500/10 p-2 text-orange-300">
            <Gauge size={18} />
          </span>
          <div>
            <h3 className="text-lg font-semibold text-white">Mileage by vehicle</h3>
            <p className="text-sm text-white/45">
              Daily route distance per vehicle (last 90 days)
            </p>
          </div>
        </div>

        {series.length === 0 || !hasMileage ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-black/40 p-6 text-sm text-white/50">
            No mileage data yet. Import EziTrack daily reports to populate this chart.
          </div>
        ) : (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="rgba(255,255,255,0.45)"
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="rgba(255,255,255,0.45)"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value} km`}
                />
                <Tooltip
                  content={
                    <PerVehicleTooltip series={series} unit="km" />
                  }
                  labelFormatter={(_, payload) => {
                    const point = payload?.[0]?.payload as FleetPerVehicleChartPoint | undefined;
                    return point?.date ?? "";
                  }}
                />
                <Legend
                  formatter={legendFormatter}
                  wrapperStyle={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}
                />
                {series.map((item) => (
                  <Line
                    key={item.vehicleId}
                    type="monotone"
                    dataKey={item.mileageKey}
                    name={item.mileageKey}
                    stroke={item.color}
                    strokeWidth={2}
                    dot={{ fill: item.color, r: 2 }}
                    activeDot={{ r: 4 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="mb-5 flex items-center gap-3">
          <span className="rounded-xl border border-orange-500/20 bg-orange-500/10 p-2 text-orange-300">
            <Fuel size={18} />
          </span>
          <div>
            <h3 className="text-lg font-semibold text-white">Fuel usage by vehicle</h3>
            <p className="text-sm text-white/45">
              Daily litres per vehicle from imports and fuel purchases
            </p>
          </div>
        </div>

        {series.length === 0 || !hasFuel ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-black/40 p-6 text-sm text-white/50">
            No fuel usage data yet. Import EziTrack reports or log fuel purchases.
          </div>
        ) : (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="rgba(255,255,255,0.45)"
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="rgba(255,255,255,0.45)"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value} L`}
                />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  content={
                    <PerVehicleTooltip series={series} unit="L" />
                  }
                  labelFormatter={(_, payload) => {
                    const point = payload?.[0]?.payload as FleetPerVehicleChartPoint | undefined;
                    return point?.date ?? "";
                  }}
                />
                <Legend
                  formatter={legendFormatter}
                  wrapperStyle={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}
                />
                {series.map((item) => (
                  <Bar
                    key={item.vehicleId}
                    dataKey={item.fuelKey}
                    name={item.fuelKey}
                    fill={item.color}
                    radius={[3, 3, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  );
}
