import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock3, UserPlus, Users } from "lucide-react";
import Sidebar from "../../../components/dashboard/components/Siderbar";
import { useAuth } from "../../../app/providers/AuthProvider";
import EmployeeTable from "../components/EmployeeTable";
import EmployeeTimesheetTable from "../components/EmployeTimeSheetTable";
import InviteUserModal from "../components/InviteUserModal";
import UpdateUserRoleModal from "../components/UpdateUserRoleModal";

import {
  getAdminPeopleStats,
  getEmployeeOverview,
  removeEmployeeFromOrganization,
  type AdminPeopleStats,
  type EmployeeOverviewRow,
  type EmployeeTimesheetSummaryRow,
} from "../services/adminService";

function StatCard({
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

export default function AdminEmployeesPage() {
  const auth = useAuth();
  const user = auth?.user ?? null;
  const profile = auth?.profile ?? null;
  const authLoading = auth?.loading ?? true;
  const organizationId = profile?.organization_id ?? null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [employees, setEmployees] = useState<EmployeeOverviewRow[]>([]);
  const [stats, setStats] = useState<AdminPeopleStats | null>(null);
  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] =
    useState<EmployeeOverviewRow | null>(null);

  const loadPage = useCallback(async () => {
    if (!organizationId) return;

    try {
      setLoading(true);
      setError("");

      const [employeesData, statsData] = await Promise.all([
        getEmployeeOverview(organizationId),
        getAdminPeopleStats(organizationId),
      ]);

      setEmployees(employeesData);
      setStats(statsData);
    } catch (err: any) {
      console.error("ADMIN EMPLOYEES LOAD ERROR:", err);
      setError(err?.message || "Failed to load employees.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    if (!organizationId) return;
    void loadPage();
  }, [organizationId, loadPage]);

  const filteredEmployees = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return employees;

    return employees.filter((employee) => {
      return (
        (employee.full_name || "").toLowerCase().includes(term) ||
        (employee.email || "").toLowerCase().includes(term) ||
        (employee.primary_role || "").toLowerCase().includes(term) ||
        (employee.department || "").toLowerCase().includes(term)
      );
    });
  }, [employees, search]);

  const filteredTimesheets = useMemo(() => {
    return filteredEmployees.map(
      (employee): EmployeeTimesheetSummaryRow => ({
        user_id: employee.id,
        full_name: employee.full_name,
        email: employee.email,
        primary_role: employee.primary_role,
        last_seen_at: employee.last_seen_at,
        today_seconds: employee.today_seconds,
        week_seconds: employee.week_seconds,
        has_active_timer: employee.has_active_timer,
      }),
    );
  }, [filteredEmployees]);

  const handleRemove = async (employee: EmployeeOverviewRow) => {
    if (!organizationId) return;

    const confirmed = window.confirm(
      `Remove ${employee.full_name || employee.email || "this user"} from the organization?`,
    );

    if (!confirmed) return;

    try {
      setActionLoadingId(employee.id);
      setError("");

      await removeEmployeeFromOrganization({
        organizationId,
        userId: employee.id,
      });

      await loadPage();
    } catch (err: any) {
      console.error("REMOVE EMPLOYEE ERROR:", err);
      setError(err?.message || "Failed to remove employee.");
    } finally {
      setActionLoadingId(null);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black p-6 text-white">
        Loading employees...
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
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
                Admin Workspace
              </p>
              <h1 className="mt-2 text-3xl font-bold">Employees</h1>
              <p className="mt-2 text-sm text-white/50">
                Manage users, roles, access, and timesheets.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black hover:bg-orange-400"
            >
              <UserPlus size={16} />
              Add User
            </button>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/60">
              Loading employee data...
            </div>
          ) : error ? (
            <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-red-300">
              {error}
            </div>
          ) : (
            <>
              <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <StatCard
                  title="Users"
                  value={stats?.totalUsers ?? 0}
                  icon={Users}
                />
                <StatCard
                  title="Active Today"
                  value={stats?.activeUsers ?? 0}
                  icon={Users}
                />
                <StatCard
                  title="Tracking Now"
                  value={stats?.currentlyTracking ?? 0}
                  icon={Clock3}
                />
                <StatCard
                  title="Today Hours"
                  value={stats?.totalTodayHours ?? 0}
                  icon={Clock3}
                />
                <StatCard
                  title="Week Hours"
                  value={stats?.totalWeekHours ?? 0}
                  icon={Clock3}
                />
              </section>

              <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, email, role, or department..."
                  className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
                />
              </div>

              {employees.length === 0 ? (
                <div className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-6 text-amber-200">
                  No users are linked to this organization yet. If other people
                  signed up already, make sure their profile exists and that
                  they have been assigned to this organization.
                </div>
              ) : null}

              <section className="mb-6">
                <EmployeeTable
                  employees={filteredEmployees}
                  onEditRole={setEditingEmployee}
                  onRemove={handleRemove}
                  actionLoadingId={actionLoadingId}
                />
              </section>

              <section>
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-white">
                    Daily & Weekly Timesheets
                  </h2>
                  <p className="mt-1 text-sm text-white/50">
                    Real-time tracking summaries across the organization.
                  </p>
                </div>

                <EmployeeTimesheetTable employees={filteredTimesheets} />
              </section>
            </>
          )}
        </main>
      </div>

      <InviteUserModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        organizationId={organizationId}
        onInvited={loadPage}
      />

      <UpdateUserRoleModal
        open={!!editingEmployee}
        onClose={() => setEditingEmployee(null)}
        organizationId={organizationId}
        employee={editingEmployee}
        onUpdated={loadPage}
      />
    </div>
  );
}
