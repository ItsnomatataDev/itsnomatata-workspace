import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Briefcase,
  CalendarDays,
  DollarSign,
  Download,
  Filter,
  PieChart as PieChartIcon,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Sidebar from "../../../components/dashboard/components/Siderbar";
import { useAuth } from "../../../app/providers/AuthProvider";
import {
  getAdminTimeEntries,
  type AdminTimeEntryRow,
  type TimeApprovalStatus,
} from "../../../lib/supabase/queries/adminTime";

function formatDuration(seconds: number) {
  const total = Math.max(0, Number(seconds || 0));
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}

function formatMoney(amount: number) {
  return `$${Number(amount || 0).toFixed(2)}`;
}

function formatHours(seconds: number) {
  return Number((seconds / 3600).toFixed(1));
}

function SummaryCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="border border-white/10 bg-[#050505] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-white/45">{title}</p>
          <p className="mt-3 text-2xl font-bold text-white">{value}</p>
          <p className="mt-2 text-xs text-white/35">{subtitle}</p>
        </div>

        <div className="border border-orange-500/20 bg-orange-500/10 p-3 text-orange-400">
          {icon}
        </div>
      </div>
    </div>
  );
}

function exportRowsToCsv(rows: AdminTimeEntryRow[]) {
  const headers = [
    "User",
    "Email",
    "Project",
    "Task",
    "Client",
    "Campaign",
    "Description",
    "Started At",
    "Ended At",
    "Duration Seconds",
    "Billable",
    "Cost Amount",
    "Approval Status",
  ];

  const escapeValue = (value: unknown) => {
    const stringValue = String(value ?? "");
    if (
      stringValue.includes(",") ||
      stringValue.includes('"') ||
      stringValue.includes("\n")
    ) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const lines = rows.map((row) =>
    [
      row.user_name,
      row.user_email,
      row.project_name,
      row.task_title,
      row.client_name,
      row.campaign_name,
      row.description,
      row.started_at,
      row.ended_at,
      row.duration_seconds,
      row.is_billable ? "Yes" : "No",
      row.cost_amount ?? 0,
      row.approval_status,
    ]
      .map(escapeValue)
      .join(","),
  );

  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", "everhour_reports_export.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const auth = useAuth();
  const profile = auth?.profile ?? null;

  const [entries, setEntries] = useState<AdminTimeEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [approvalStatus, setApprovalStatus] = useState<
    TimeApprovalStatus | "all"
  >("all");
  const [isBillable, setIsBillable] = useState<boolean | "all">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const organizationId = profile?.organization_id ?? null;

  useEffect(() => {
    const load = async () => {
      if (!organizationId) return;

      try {
        setLoading(true);
        setError("");

        const rows = await getAdminTimeEntries({
          organizationId,
          approvalStatus,
          isBillable,
          from: from ? new Date(from).toISOString() : undefined,
          to: to ? new Date(to).toISOString() : undefined,
          limit: 1000,
        });

        setEntries(rows);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load reports data.",
        );
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [organizationId, approvalStatus, isBillable, from, to]);

  const totalSeconds = useMemo(() => {
    return entries.reduce(
      (sum, entry) => sum + Number(entry.duration_seconds ?? 0),
      0,
    );
  }, [entries]);

  const billableSeconds = useMemo(() => {
    return entries.reduce((sum, entry) => {
      return entry.is_billable
        ? sum + Number(entry.duration_seconds ?? 0)
        : sum;
    }, 0);
  }, [entries]);

  const nonBillableSeconds = Math.max(0, totalSeconds - billableSeconds);

  const totalCost = useMemo(() => {
    return entries.reduce((sum, entry) => {
      return sum + Number(entry.cost_amount ?? 0);
    }, 0);
  }, [entries]);

  const approvedSeconds = useMemo(() => {
    return entries.reduce((sum, entry) => {
      return entry.approval_status === "approved"
        ? sum + Number(entry.duration_seconds ?? 0)
        : sum;
    }, 0);
  }, [entries]);

  const topProjects = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        seconds: number;
        billableSeconds: number;
        cost: number;
      }
    >();

    for (const entry of entries) {
      const key = entry.project_id || "no-project";
      const current = map.get(key) ?? {
        name: entry.project_name || "No project",
        seconds: 0,
        billableSeconds: 0,
        cost: 0,
      };

      const duration = Number(entry.duration_seconds ?? 0);
      current.seconds += duration;
      if (entry.is_billable) {
        current.billableSeconds += duration;
      }
      current.cost += Number(entry.cost_amount ?? 0);

      map.set(key, current);
    }

    return Array.from(map.values())
      .sort((a, b) => b.seconds - a.seconds)
      .slice(0, 8);
  }, [entries]);

  const topMembers = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        email: string;
        seconds: number;
        billableSeconds: number;
        cost: number;
      }
    >();

    for (const entry of entries) {
      const key = entry.user_id;
      const current = map.get(key) ?? {
        name: entry.user_name || "Unknown member",
        email: entry.user_email || "No email",
        seconds: 0,
        billableSeconds: 0,
        cost: 0,
      };

      const duration = Number(entry.duration_seconds ?? 0);
      current.seconds += duration;
      if (entry.is_billable) {
        current.billableSeconds += duration;
      }
      current.cost += Number(entry.cost_amount ?? 0);

      map.set(key, current);
    }

    return Array.from(map.values())
      .sort((a, b) => b.seconds - a.seconds)
      .slice(0, 8);
  }, [entries]);

  const dailyTrend = useMemo(() => {
    const map = new Map<
      string,
      {
        label: string;
        trackedHours: number;
        billableHours: number;
        cost: number;
      }
    >();

    for (const entry of entries) {
      const raw = entry.started_at?.slice(0, 10) || "unknown";
      const date = new Date(entry.started_at);
      const label = Number.isNaN(date.getTime())
        ? raw
        : date.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          });

      const current = map.get(raw) ?? {
        label,
        trackedHours: 0,
        billableHours: 0,
        cost: 0,
      };

      const hours = Number(entry.duration_seconds ?? 0) / 3600;
      current.trackedHours += hours;
      if (entry.is_billable) {
        current.billableHours += hours;
      }
      current.cost += Number(entry.cost_amount ?? 0);

      map.set(raw, current);
    }

    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-14)
      .map(([, value]) => ({
        ...value,
        trackedHours: Number(value.trackedHours.toFixed(1)),
        billableHours: Number(value.billableHours.toFixed(1)),
        cost: Number(value.cost.toFixed(2)),
      }));
  }, [entries]);

  const billingSplit = [
    {
      name: "Billable",
      value: formatHours(billableSeconds),
    },
    {
      name: "Non-billable",
      value: formatHours(nonBillableSeconds),
    },
  ];

  if (!auth?.user || !profile) return null;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen">
        <Sidebar role={profile.primary_role ?? "manager"} />

        <main className="min-w-0 flex-1 p-6 lg:p-8">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
                Everhour Reports
              </p>
              <h1 className="mt-2 text-3xl font-bold">Reports</h1>
              <p className="mt-2 text-sm text-white/50">
                Track time by project, member, billable usage, cost, and daily
                trends across the organization.
              </p>
            </div>

            <button
              type="button"
              onClick={() => exportRowsToCsv(entries)}
              className="inline-flex items-center gap-2 border border-orange-500 bg-orange-500 px-4 py-3 text-sm font-semibold text-black"
            >
              <Download size={16} />
              Export CSV
            </button>
          </div>

          {error ? (
            <div className="mb-6 border border-red-500/20 bg-red-500/10 p-4 text-red-300">
              {error}
            </div>
          ) : null}

          <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="Tracked Time"
              value={formatDuration(totalSeconds)}
              subtitle="All visible tracked time"
              icon={<CalendarDays size={18} />}
            />
            <SummaryCard
              title="Billable Time"
              value={formatDuration(billableSeconds)}
              subtitle={`Non-billable: ${formatDuration(nonBillableSeconds)}`}
              icon={<Briefcase size={18} />}
            />
            <SummaryCard
              title="Approved Time"
              value={formatDuration(approvedSeconds)}
              subtitle="Time already approved in scope"
              icon={<Users size={18} />}
            />
            <SummaryCard
              title="Cost"
              value={formatMoney(totalCost)}
              subtitle="Based on rate snapshots"
              icon={<DollarSign size={18} />}
            />
          </div>

          <div className="mb-6 border border-white/10 bg-[#050505] p-4">
            <div className="mb-4 flex items-center gap-2 text-sm text-white/60">
              <Filter size={14} className="text-orange-400" />
              <span>Filter reports</span>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <select
                value={approvalStatus}
                onChange={(event) =>
                  setApprovalStatus(
                    event.target.value as TimeApprovalStatus | "all",
                  )
                }
                className="border border-white/10 bg-black px-4 py-3 text-white outline-none"
              >
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>

              <select
                value={String(isBillable)}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === "all") {
                    setIsBillable("all");
                  } else {
                    setIsBillable(value === "true");
                  }
                }}
                className="border border-white/10 bg-black px-4 py-3 text-white outline-none"
              >
                <option value="all">All billing</option>
                <option value="true">Billable</option>
                <option value="false">Non-billable</option>
              </select>

              <input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                className="border border-white/10 bg-black px-4 py-3 text-white outline-none"
              />

              <input
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                className="border border-white/10 bg-black px-4 py-3 text-white outline-none"
              />

              <div className="border border-white/10 bg-black px-4 py-3 text-sm text-white/50">
                {entries.length} entries loaded
              </div>
            </div>
          </div>

          {loading ? (
            <div className="border border-white/10 bg-[#050505] p-6 text-white/60">
              Loading reports...
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
                <section className="border border-white/10 bg-[#050505] p-5">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="border border-orange-500/20 bg-orange-500/10 p-2 text-orange-400">
                      <BarChart3 size={18} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        Daily Trend
                      </h3>
                      <p className="text-sm text-white/45">
                        Tracked and billable hours over time
                      </p>
                    </div>
                  </div>

                  {dailyTrend.length === 0 ? (
                    <div className="border border-white/10 bg-black/40 p-6 text-sm text-white/50">
                      No trend data available for the current filter.
                    </div>
                  ) : (
                    <div className="h-80 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dailyTrend}>
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
                                typeof value === "number"
                                  ? value
                                  : Number(value ?? 0);

                              if (name === "trackedHours") {
                                return [
                                  `${numericValue.toFixed(1)}h`,
                                  "Tracked",
                                ];
                              }

                              if (name === "billableHours") {
                                return [
                                  `${numericValue.toFixed(1)}h`,
                                  "Billable",
                                ];
                              }

                              return [String(value ?? 0), String(name ?? "")];
                            }}
                          />
                          <Legend />
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

                <section className="border border-white/10 bg-[#050505] p-5">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="border border-orange-500/20 bg-orange-500/10 p-2 text-orange-400">
                      <PieChartIcon size={18} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        Billing Split
                      </h3>
                      <p className="text-sm text-white/45">
                        Billable vs non-billable hours
                      </p>
                    </div>
                  </div>

                  <div className="h-65 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#050505",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: 0,
                            color: "#fff",
                          }}
                          formatter={(value) => [`${value}h`, "Hours"]}
                        />
                        <Pie
                          data={billingSplit}
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

                  <div className="mt-3 space-y-3">
                    <div className="flex items-center justify-between border border-white/10 bg-black/40 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 bg-orange-500" />
                        <span className="text-sm text-white/60">Billable</span>
                      </div>
                      <span className="text-sm font-semibold text-white">
                        {formatDuration(billableSeconds)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between border border-white/10 bg-black/40 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 bg-white" />
                        <span className="text-sm text-white/60">
                          Non-billable
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-white">
                        {formatDuration(nonBillableSeconds)}
                      </span>
                    </div>
                  </div>
                </section>
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <section className="border border-white/10 bg-[#050505] p-5">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        Top Projects
                      </h3>
                      <p className="text-sm text-white/45">
                        Highest tracked project groups
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {topProjects.length === 0 ? (
                      <div className="border border-white/10 bg-black/40 p-4 text-sm text-white/50">
                        No project data found.
                      </div>
                    ) : (
                      topProjects.map((project, index) => (
                        <div
                          key={`${project.name}-${index}`}
                          className="border border-white/10 bg-black/40 px-4 py-4"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-white">
                                {project.name}
                              </p>
                              <p className="mt-2 text-xs text-white/45">
                                Billable:{" "}
                                {formatDuration(project.billableSeconds)}
                              </p>
                            </div>

                            <div className="text-right">
                              <p className="text-sm font-semibold text-orange-300">
                                {formatDuration(project.seconds)}
                              </p>
                              <p className="mt-1 text-xs text-white/40">
                                {formatMoney(project.cost)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section className="border border-white/10 bg-[#050505] p-5">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        Top Members
                      </h3>
                      <p className="text-sm text-white/45">
                        Highest tracked contributors
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {topMembers.length === 0 ? (
                      <div className="border border-white/10 bg-black/40 p-4 text-sm text-white/50">
                        No member data found.
                      </div>
                    ) : (
                      topMembers.map((member, index) => (
                        <div
                          key={`${member.email}-${index}`}
                          className="border border-white/10 bg-black/40 px-4 py-4"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-white">
                                {member.name}
                              </p>
                              <p className="truncate mt-1 text-xs text-white/40">
                                {member.email}
                              </p>
                              <p className="mt-2 text-xs text-white/45">
                                Billable:{" "}
                                {formatDuration(member.billableSeconds)}
                              </p>
                            </div>

                            <div className="text-right">
                              <p className="text-sm font-semibold text-orange-300">
                                {formatDuration(member.seconds)}
                              </p>
                              <p className="mt-1 text-xs text-white/40">
                                {formatMoney(member.cost)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
