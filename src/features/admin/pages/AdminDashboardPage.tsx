import { useCallback, useEffect, useState } from "react";
import {
  Users,
  CalendarDays,
  HandCoins,
  PackageSearch,
  CheckSquare,
  MessagesSquare,
  Clock3,
  Activity,
} from "lucide-react";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import { useAuth } from "../../../app/providers/AuthProvider";
import {
  getAdminDashboardStats,
  getAdminPeopleStats,
  getLowStockItems,
  getRecentCRMDeals,
  getRecentLeaveRequests,
  type AdminDashboardStats,
  type AdminPeopleStats,
} from "../services/adminService";
import { supabase } from "../../../lib/supabase/client";

function AdminStatCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ size?: number }>;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/60">{title}</p>
        <div className="rounded-xl bg-orange-500/15 p-2 text-orange-500">
          <Icon size={18} />
        </div>
      </div>
      <p className="mt-4 text-3xl font-bold text-white">{value}</p>
    </div>
  );
}

export default function AdminDashboardPage() {
  const auth = useAuth();
  const user = auth?.user ?? null;
  const profile = auth?.profile ?? null;
  const authLoading = auth?.loading ?? true;
  const organizationId = profile?.organization_id ?? null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [peopleStats, setPeopleStats] = useState<AdminPeopleStats | null>(null);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [crmDeals, setCrmDeals] = useState<any[]>([]);

  const loadDashboard = useCallback(async () => {
    if (!organizationId) return;

    try {
      setError("");

      const [statsData, peopleData, leaveData, stockData, dealsData] =
        await Promise.all([
          getAdminDashboardStats(organizationId),
          getAdminPeopleStats(organizationId),
          getRecentLeaveRequests(organizationId),
          getLowStockItems(organizationId),
          getRecentCRMDeals(organizationId),
        ]);

      setStats(statsData);
      setPeopleStats(peopleData);
      setLeaveRequests(leaveData);
      setLowStockItems(stockData);
      setCrmDeals(dealsData);
    } catch (err: any) {
      console.error("ADMIN DASHBOARD LOAD ERROR:", err);
      setError(err?.message || "Failed to load admin dashboard.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    if (!organizationId) return;
    void loadDashboard();
  }, [organizationId, loadDashboard]);

  useEffect(() => {
    if (!organizationId) return;

    const channel = supabase
      .channel(`admin-dashboard-${organizationId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => void loadDashboard(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "organization_members" },
        () => void loadDashboard(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "time_entries" },
        () => void loadDashboard(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leave_requests" },
        () => void loadDashboard(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [organizationId, loadDashboard]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black p-6 text-white">
        Loading admin dashboard...
      </div>
    );
  }

  if (!user || !profile || !organizationId) {
    return (
      <div className="min-h-screen bg-black p-6 text-white">
        Missing admin workspace context.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen">
        <Sidebar role={profile.primary_role} />

        <main className="flex-1 p-6 lg:p-8">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
              Admin Workspace
            </p>
            <h1 className="mt-2 text-3xl font-bold">Admin Dashboard</h1>
            <p className="mt-2 text-sm text-white/50">
              Organization-wide control center for operations, people, and
              systems.
            </p>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/60">
              Loading admin workspace...
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-red-300">
              {error}
            </div>
          ) : (
            <>
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <AdminStatCard
                  title="Users"
                  value={peopleStats?.totalUsers ?? 0}
                  icon={Users}
                />
                <AdminStatCard
                  title="Active Users"
                  value={peopleStats?.activeUsers ?? 0}
                  icon={Activity}
                />
                <AdminStatCard
                  title="Tracking Now"
                  value={peopleStats?.currentlyTracking ?? 0}
                  icon={Clock3}
                />
                <AdminStatCard
                  title="Today Hours"
                  value={peopleStats?.totalTodayHours ?? 0}
                  icon={Clock3}
                />
                <AdminStatCard
                  title="Week Hours"
                  value={peopleStats?.totalWeekHours ?? 0}
                  icon={Clock3}
                />
              </section>

              <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <AdminStatCard
                  title="Pending Leave"
                  value={stats?.pendingLeaveRequests ?? 0}
                  icon={CalendarDays}
                />
                <AdminStatCard
                  title="Active Deals"
                  value={stats?.activeCRMDeals ?? 0}
                  icon={HandCoins}
                />
                <AdminStatCard
                  title="Low Stock"
                  value={stats?.lowStockItems ?? 0}
                  icon={PackageSearch}
                />
                <AdminStatCard
                  title="Open Tasks"
                  value={stats?.openTasks ?? 0}
                  icon={CheckSquare}
                />
                <AdminStatCard
                  title="Channels"
                  value={stats?.activeChannels ?? 0}
                  icon={MessagesSquare}
                />
              </section>

              <section className="mt-6 grid gap-6 xl:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h2 className="text-lg font-semibold">
                    Recent Leave Requests
                  </h2>
                  <div className="mt-4 space-y-3">
                    {leaveRequests.length === 0 ? (
                      <p className="text-sm text-white/50">
                        No leave requests found.
                      </p>
                    ) : (
                      leaveRequests.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl border border-white/10 bg-black/30 px-4 py-3"
                        >
                          <p className="font-medium text-white">
                            {item.status}
                          </p>
                          <p className="mt-1 text-sm text-white/60">
                            {item.start_date} → {item.end_date}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h2 className="text-lg font-semibold">Low Stock Items</h2>
                  <div className="mt-4 space-y-3">
                    {lowStockItems.length === 0 ? (
                      <p className="text-sm text-white/50">
                        No low stock alerts.
                      </p>
                    ) : (
                      lowStockItems.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl border border-white/10 bg-black/30 px-4 py-3"
                        >
                          <p className="font-medium text-white">{item.name}</p>
                          <p className="mt-1 text-sm text-white/60">
                            Qty: {item.quantity} • Reorder: {item.reorder_level}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h2 className="text-lg font-semibold">Recent CRM Deals</h2>
                  <div className="mt-4 space-y-3">
                    {crmDeals.length === 0 ? (
                      <p className="text-sm text-white/50">
                        No CRM deals found.
                      </p>
                    ) : (
                      crmDeals.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl border border-white/10 bg-black/30 px-4 py-3"
                        >
                          <p className="font-medium text-white">{item.title}</p>
                          <p className="mt-1 text-sm text-white/60">
                            {item.stage} • ${item.value}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
