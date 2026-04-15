import {
  BarChart3,
  Clock3,
  DollarSign,
  PieChart as PieChartIcon,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type DailyPoint = {
  label: string;
  trackedHours: number;
  billableHours: number;
  cost: number;
};

function formatHours(value: number) {
  return `${Number(value || 0).toFixed(1)}h`;
}

function formatMoney(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

export default function TimeChartsPanel({
  dailyData,
  billableSeconds,
  nonBillableSeconds,
  totalCost,
}: {
  dailyData: DailyPoint[];
  billableSeconds: number;
  nonBillableSeconds: number;
  totalCost: number;
}) {
  const pieData = [
    {
      name: "Billable",
      value: Number((billableSeconds / 3600).toFixed(2)),
    },
    {
      name: "Non-billable",
      value: Number((nonBillableSeconds / 3600).toFixed(2)),
    },
  ];

  const hasDailyData = dailyData.length > 0;
  const hasPieData = pieData.some((item) => item.value > 0);

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
      <section className="border border-white/10 bg-[#050505] p-5">
        <div className="mb-5 flex items-center gap-3">
          <div className="border border-orange-500/20 bg-orange-500/10 p-2 text-orange-400">
            <BarChart3 size={18} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">
              Tracked Time Trend
            </h3>
            <p className="text-sm text-white/45">
              Daily tracked and billable hours across the current result set
            </p>
          </div>
        </div>

        {!hasDailyData ? (
          <div className="border border-white/10 bg-black/40 p-6 text-sm text-white/50">
            No chart data available for this filter yet.
          </div>
        ) : (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData}>
                <CartesianGrid
                  stroke="rgba(255,255,255,0.08)"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  stroke="rgba(255,255,255,0.45)"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.45)"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value}h`}
                />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  contentStyle={{
                    backgroundColor: "#050505",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 0,
                    color: "#fff",
                  }}
                  formatter={(value, name) => {
                    const numericValue =
                      typeof value === "number" ? value : Number(value ?? 0);

                    if (name === "trackedHours") {
                      return [formatHours(numericValue), "Tracked"];
                    }

                    if (name === "billableHours") {
                      return [formatHours(numericValue), "Billable"];
                    }

                    return [String(value ?? 0), String(name ?? "")];
                  }}
                />
                <Bar
                  dataKey="trackedHours"
                  name="trackedHours"
                  fill="#f97316"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="billableHours"
                  name="billableHours"
                  fill="#ffffff"
                  radius={[0, 0, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="space-y-6">
        <div className="border border-white/10 bg-[#050505] p-5">
          <div className="mb-5 flex items-center gap-3">
            <div className="border border-orange-500/20 bg-orange-500/10 p-2 text-orange-400">
              <PieChartIcon size={18} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                Billing Split
              </h3>
              <p className="text-sm text-white/45">
                Billable vs non-billable tracked time
              </p>
            </div>
          </div>

          {!hasPieData ? (
            <div className="border border-white/10 bg-black/40 p-6 text-sm text-white/50">
              No billing breakdown available yet.
            </div>
          ) : (
            <>
              <div className="h-55 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#050505",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 0,
                        color: "#fff",
                      }}
                      formatter={(value) => {
                        const numericValue =
                          typeof value === "number" ? value : Number(value ?? 0);
                        return [formatHours(numericValue), "Hours"];
                      }}
                    />
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={2}
                    >
                      <Cell fill="#f97316" />
                      <Cell fill="#ffffff" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-3 grid gap-3">
                <div className="flex items-center justify-between border border-white/10 bg-black/40 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 bg-orange-500" />
                    <span className="text-sm text-white/60">Billable</span>
                  </div>
                  <span className="text-sm font-semibold text-white">
                    {formatHours(billableSeconds / 3600)}
                  </span>
                </div>

                <div className="flex items-center justify-between border border-white/10 bg-black/40 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 bg-white" />
                    <span className="text-sm text-white/60">Non-billable</span>
                  </div>
                  <span className="text-sm font-semibold text-white">
                    {formatHours(nonBillableSeconds / 3600)}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="border border-white/10 bg-[#050505] p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="border border-orange-500/20 bg-orange-500/10 p-2 text-orange-400">
              <DollarSign size={18} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                Cost Snapshot
              </h3>
              <p className="text-sm text-white/45">
                Current visible cost footprint
              </p>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="border border-white/10 bg-black/40 px-4 py-4">
              <p className="text-sm text-white/45">Visible total cost</p>
              <p className="mt-2 text-2xl font-bold text-white">
                {formatMoney(totalCost)}
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
              <div className="border border-white/10 bg-black/40 px-4 py-3">
                <div className="flex items-center gap-2 text-orange-400">
                  <Clock3 size={14} />
                  <span className="text-xs uppercase tracking-[0.2em]">
                    Billable value
                  </span>
                </div>
                <p className="mt-2 text-sm text-white/60">
                  Based on recorded hourly rate snapshots in your time entries.
                </p>
              </div>

              <div className="border border-white/10 bg-black/40 px-4 py-3">
                <div className="flex items-center gap-2 text-orange-400">
                  <Clock3 size={14} />
                  <span className="text-xs uppercase tracking-[0.2em]">
                    Admin visibility
                  </span>
                </div>
                <p className="mt-2 text-sm text-white/60">
                  Managers can use this to see where time and cost are really
                  going.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
