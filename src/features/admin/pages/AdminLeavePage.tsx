import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Plus, ShieldCheck, Unlock } from "lucide-react";
import { toast } from "react-toastify";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import { useAuth } from "../../../app/providers/AuthProvider";
import LeaveRequestTable from "../components/LeaveRequestTable";
import CreateLeaveTypeModal from "../components/CreateLeaveTypeModal";
import CreateLeaveRuleModal from "../../leave/components/CreateLeaveRuleModal";
import LeaveCalendar from "../../leave/components/leaveCalender";
import LeaveRuleList from "../../leave/components/LeaveRuleList";
import ModifyLeaveRequestModal from "../components/ModifyLeaveRequestModal";
import LeaveBalanceAdjustmentCard from "../components/LeaveBalanceAdjustmentCard";
import {
  getLeaveRequests,
  getLeaveTypes,
  updateLeaveRequestStatus,
  type LeaveRequestRow,
  type LeaveTypeRow,
} from "../services/adminService";
import {
  getApprovedLeaveCalendarEvents,
  getLeaveCalendarRules,
  updateApprovedLeaveEventDates,
  deleteLeaveCalendarRule,
  type LeaveCalendarEventRow,
  type LeaveCalendarRuleRow,
} from "../../leave/services/leaveCalendarService";
import {
  modifyLeaveRequestDates,
  modifyUserLeaveBalance,
  getPublicHolidays,
} from "../../leave/services/leaveService";
import { OFFICE_OPTIONS, type CompanyOffice } from "../../../lib/offices";
import { getCompanyOffices } from "../../../lib/supabase/queries/offices";
import {
  getLeaveCountingRuleLabel,
  normalizeLeaveOffice,
} from "../../leave/utils/leaveDays";
import {
  getLeaveBalanceEmployees,
  getRecentBalanceHistory,
  type LeaveBalanceAuditHistoryRow,
  type LeaveBalanceEmployeeRow,
} from "../../leave/services/leaveBalanceAuditService";
import type { PublicHolidayRow } from "../../leave/components/leaveCalender";

function formatDateForDb(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function AdminLeavePage() {
  const auth = useAuth();
  const user = auth?.user ?? null;
  const profile = auth?.profile ?? null;
  const authLoading = auth?.loading ?? true;

  const organizationId = profile?.organization_id ?? null;
  const userId = user?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);
  const [requests, setRequests] = useState<LeaveRequestRow[]>([]);
  const [offices, setOffices] = useState<CompanyOffice[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeRow[]>([]);
  const [approvedLeaves, setApprovedLeaves] = useState<LeaveCalendarEventRow[]>(
    [],
  );
  const [rules, setRules] = useState<LeaveCalendarRuleRow[]>([]);
  const [holidays, setHolidays] = useState<PublicHolidayRow[]>([]);
  const [createTypeOpen, setCreateTypeOpen] = useState(false);
  const [createRuleOpen, setCreateRuleOpen] = useState(false);
  const [modifyLeaveOpen, setModifyLeaveOpen] = useState(false);
  const [balanceSaving, setBalanceSaving] = useState(false);
  const [selectedLeaveForModify, setSelectedLeaveForModify] = useState<LeaveRequestRow | null>(null);
  const [balanceEmployees, setBalanceEmployees] = useState<LeaveBalanceEmployeeRow[]>([]);
  const [balanceHistory, setBalanceHistory] = useState<LeaveBalanceAuditHistoryRow[]>([]);
  const [activeFilter, setActiveFilter] = useState<
    "all" | "pending" | "approved" | "rejected"
  >("all");
  const [selectedOfficeId, setSelectedOfficeId] = useState("all");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [leaveTypeFilter, setLeaveTypeFilter] = useState("all");
  const [rangeStartFilter, setRangeStartFilter] = useState("");
  const [rangeEndFilter, setRangeEndFilter] = useState("");

  const loadPage = useCallback(async () => {
    if (!organizationId) return;
    const shouldLoadBalanceTools = profile?.primary_role === "admin";
    const officeId = selectedOfficeId === "all" ? null : selectedOfficeId;

    try {
      setLoading(true);
      setError("");

      const [
        requestsData,
        officesData,
        leaveTypesData,
        approvedLeavesData,
        rulesData,
        holidaysData,
        balanceEmployeesData,
        balanceHistoryData,
      ] =
        await Promise.all([
          getLeaveRequests({ organizationId, officeId }),
          getCompanyOffices(organizationId),
          getLeaveTypes(organizationId),
          getApprovedLeaveCalendarEvents({ organizationId, officeId }),
          getLeaveCalendarRules(organizationId),
          getPublicHolidays({ organizationId }),
          shouldLoadBalanceTools
            ? getLeaveBalanceEmployees({ organizationId, officeId })
            : Promise.resolve([]),
          shouldLoadBalanceTools
            ? getRecentBalanceHistory({ organizationId, officeId, limit: 8 })
            : Promise.resolve([]),
        ]);

      setRequests(requestsData);
      setOffices(officesData);
      setLeaveTypes(leaveTypesData);
      setApprovedLeaves(approvedLeavesData);
      setRules(rulesData);
      setHolidays(holidaysData);
      setBalanceEmployees(balanceEmployeesData);
      setBalanceHistory(balanceHistoryData);
    } catch (err: any) {
      console.error("ADMIN LEAVE LOAD ERROR:", err);
      setError(err?.message || "Failed to load leave management.");
    } finally {
      setLoading(false);
    }
  }, [organizationId, profile?.primary_role, selectedOfficeId]);

  useEffect(() => {
    if (!organizationId) return;
    void loadPage();
  }, [organizationId, loadPage]);

  useEffect(() => {
    if (!successMessage) return;

    const timeout = window.setTimeout(() => {
      setSuccessMessage("");
    }, 3500);

    return () => window.clearTimeout(timeout);
  }, [successMessage]);

  const handleApprove = async (request: LeaveRequestRow) => {
    if (!userId || !organizationId) return;

    try {
      setActionLoadingId(request.id);
      setError("");
      setSuccessMessage("");

      await updateLeaveRequestStatus({
        leaveRequestId: request.id,
        organizationId,
        status: "approved",
        approvedBy: userId,
      });

      setSuccessMessage(
        `Leave request for ${
          request.requester_name || request.requester_email || "employee"
        } was approved.`,
      );

      await loadPage();
    } catch (err: any) {
      console.error("APPROVE LEAVE ERROR:", err);
      setError(err?.message || "Failed to approve leave request.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (request: LeaveRequestRow) => {
    if (!userId || !organizationId) return;

    const rejectionReason = window.prompt(
      `Why are you rejecting leave for ${
        request.requester_name || request.requester_email || "this user"
      }?`,
    );

    if (!rejectionReason || !rejectionReason.trim()) {
      setError("A rejection reason is required.");
      return;
    }

    try {
      setActionLoadingId(request.id);
      setError("");
      setSuccessMessage("");

      await updateLeaveRequestStatus({
        leaveRequestId: request.id,
        organizationId,
        status: "rejected",
        approvedBy: userId,
        rejectionReason: rejectionReason.trim(),
      });

      setSuccessMessage(
        `Leave request for ${
          request.requester_name || request.requester_email || "employee"
        } was rejected.`,
      );

      await loadPage();
    } catch (err: any) {
      console.error("REJECT LEAVE ERROR:", err);
      setError(err?.message || "Failed to reject leave request.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleMoveApprovedLeave = async (params: {
    eventId: string;
    start: Date;
    end: Date;
  }) => {
    if (!organizationId || !userId) return;

    try {
      setError("");
      setSuccessMessage("");

      const startDate = formatDateForDb(params.start);
      const endDate = formatDateForDb(params.end);

      await modifyLeaveRequestDates({
        organizationId,
        leaveRequestId: params.eventId,
        modifiedByUserId: userId,
        newStartDate: startDate,
        newEndDate: endDate,
        reason: "Admin calendar adjustment",
      });

      setSuccessMessage("Leave dates updated successfully.");
      await loadPage();
    } catch (err: any) {
      console.error("MOVE LEAVE ERROR:", err);
      setError(err?.message || "Failed to update leave dates.");
    }
  };

  const handleModifyLeaveDates = async (request: LeaveRequestRow) => {
    setSelectedLeaveForModify(request);
    setModifyLeaveOpen(true);
  };

  const handleSaveLeaveModification = async (params: {
    newStartDate: string;
    newEndDate: string;
    office: string;
    reason: string;
  }) => {
    if (!selectedLeaveForModify || !userId || !organizationId) return;

    try {
      setError("");
      setSuccessMessage("");

      await modifyLeaveRequestDates({
        organizationId,
        leaveRequestId: selectedLeaveForModify.id,
        modifiedByUserId: userId,
        newStartDate: params.newStartDate,
        newEndDate: params.newEndDate,
        office: params.office,
        reason: params.reason,
      });

      setSuccessMessage("Leave dates modified successfully.");
      setModifyLeaveOpen(false);
      setSelectedLeaveForModify(null);
      await loadPage();
    } catch (err: any) {
      console.error("MODIFY LEAVE ERROR:", err);
      setError(err?.message || "Failed to modify leave dates.");
    }
  };

  const handleSaveBalanceModification = async (params: {
    userId: string;
    newTotal: number;
    newRemaining: number;
    reason: string;
  }) => {
    if (!userId || !organizationId) return;

    try {
      setBalanceSaving(true);
      setError("");
      setSuccessMessage("");

      await modifyUserLeaveBalance({
        organizationId,
        userId: params.userId,
        modifiedByUserId: userId,
        newTotal: params.newTotal,
        newRemaining: params.newRemaining,
        reason: params.reason,
        officeId: selectedOfficeId === "all" ? null : selectedOfficeId,
      });

      setSuccessMessage("Leave balance updated successfully.");
      toast.success("Leave balance updated successfully.");
      await loadPage();
    } catch (err: any) {
      console.error("MODIFY BALANCE ERROR:", err);
      setError(err?.message || "Failed to modify leave balance.");
      throw err;
    } finally {
      setBalanceSaving(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this leave rule?",
    );

    if (!confirmed) return;

    try {
      setDeletingRuleId(ruleId);
      setError("");
      setSuccessMessage("");

      await deleteLeaveCalendarRule(ruleId);

      setSuccessMessage("Leave calendar rule deleted.");
      await loadPage();
    } catch (err: any) {
      console.error("DELETE LEAVE RULE ERROR:", err);
      setError(err?.message || "Failed to delete leave calendar rule.");
    } finally {
      setDeletingRuleId(null);
    }
  };

  const filteredRequests = useMemo(() => {
    return requests.filter((request) => {
      if (activeFilter !== "all" && request.status !== activeFilter) return false;
      if (employeeFilter !== "all" && request.user_id !== employeeFilter) return false;
      if (leaveTypeFilter !== "all" && request.leave_type_id !== leaveTypeFilter) {
        return false;
      }
      if (selectedOfficeId !== "all") {
        const requestOfficeId = request.office_id ?? request.requester_office_id ?? null;
        if (requestOfficeId !== selectedOfficeId) return false;
      }
      if (rangeStartFilter && request.end_date < rangeStartFilter) return false;
      if (rangeEndFilter && request.start_date > rangeEndFilter) return false;

      return true;
    });
  }, [
    activeFilter,
    employeeFilter,
    leaveTypeFilter,
    rangeEndFilter,
    rangeStartFilter,
    requests,
    selectedOfficeId,
  ]);

  const filteredCalendarLeaves = useMemo(
    () =>
      approvedLeaves.filter((leave) => {
        if (activeFilter !== "all" && leave.status !== activeFilter) return false;
        if (employeeFilter !== "all" && leave.user_id !== employeeFilter) {
          return false;
        }
        if (leaveTypeFilter !== "all" && leave.leave_type_id !== leaveTypeFilter) {
          return false;
        }
        if (selectedOfficeId !== "all") {
          const leaveOfficeId = leave.office_id ?? leave.requester_office_id ?? null;
          if (leaveOfficeId !== selectedOfficeId) return false;
        }
        if (rangeStartFilter && leave.end_date < rangeStartFilter) return false;
        if (rangeEndFilter && leave.start_date > rangeEndFilter) return false;

        return true;
      }),
    [
      activeFilter,
      approvedLeaves,
      employeeFilter,
      leaveTypeFilter,
      rangeEndFilter,
      rangeStartFilter,
      selectedOfficeId,
    ],
  );

  const pendingCount = filteredRequests.filter(
    (item) => item.status === "pending",
  ).length;
  const approvedCount = filteredRequests.filter(
    (item) => item.status === "approved",
  ).length;
  const rejectedCount = filteredRequests.filter(
    (item) => item.status === "rejected",
  ).length;
  const currentMonthKey = formatDateForDb(new Date()).slice(0, 7);
  const todayKey = formatDateForDb(new Date());
  const approvedThisMonthCount = filteredRequests.filter(
    (item) =>
      item.status === "approved" && item.start_date.slice(0, 7) === currentMonthKey,
  ).length;
  const staffOnLeaveTodayCount = filteredRequests.filter(
    (item) =>
      item.status === "approved" &&
      item.start_date <= todayKey &&
      item.end_date >= todayKey,
  ).length;
  const selectedOffice = offices.find((office) => office.id === selectedOfficeId);
  const selectedOfficeName =
    selectedOfficeId === "all"
      ? "All Offices"
      : selectedOffice?.name ?? "Selected office";
  const officeSelectOptions =
    offices.length > 0
      ? offices
      : OFFICE_OPTIONS.map((office) => ({
          id: office.slug,
          organization_id: organizationId ?? "",
          name: office.name,
          slug: office.slug,
          is_primary: office.slug === "its-no-matata",
        }));
  const officeCounts = officeSelectOptions.map((office) => ({
    office: office.name,
    count: filteredRequests.filter((request) => {
      if (request.office_id || request.requester_office_id) {
        return (request.office_id ?? request.requester_office_id) === office.id;
      }

      return (
        normalizeLeaveOffice(request.office ?? request.requester_department) ===
        office.name
      );
    }).length,
  }));
  const balanceSummary = balanceEmployees.reduce(
    (summary, employee) => {
      const total = Number(employee.leave_days_total ?? 0);
      const remaining = Number(employee.leave_days_remaining ?? 0);
      summary.total += total;
      summary.remaining += remaining;
      summary.used += Math.max(total - remaining, 0);
      return summary;
    },
    { total: 0, remaining: 0, used: 0 },
  );
  const pendingDays = filteredRequests
    .filter((request) => request.status === "pending")
    .reduce((total, request) => total + Number(request.requested_days ?? 0), 0);
  const requestsByStatus = ["pending", "approved", "rejected"].map((status) => ({
    status,
    count: filteredRequests.filter((request) => request.status === status).length,
  }));
  const leaveTypeCounts = leaveTypes.map((type) => ({
    name: type.name,
    count: filteredRequests.filter((request) => request.leave_type_id === type.id)
      .length,
  }));
  const employeeOptions = Array.from(
    new Map(
      balanceEmployees.map((employee) => [
        employee.id,
        employee.full_name || employee.email || employee.id,
      ]),
    ).entries(),
  );

  const closedRulesCount = rules.filter(
    (rule) => rule.rule_type === "closed",
  ).length;
  const openRulesCount = rules.filter(
    (rule) => rule.rule_type === "open",
  ).length;
  const canAdjustLeaveBalances = profile?.primary_role === "admin";

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black px-4 py-6 text-white sm:px-6">
        Loading leave review...
      </div>
    );
  }

  if (!user || !profile || !organizationId || !userId) {
    return (
      <div className="min-h-screen bg-black px-4 py-6 text-white sm:px-6">
        Missing admin workspace context.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <Sidebar role={profile.primary_role} />

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
                Admin Workspace
              </p>
              <h1 className="mt-2 text-3xl font-bold">Leave Review</h1>
              <p className="mt-2 text-sm text-white/50">
                Review submitted leave requests, manage leave types, and control
                leave periods.
              </p>
              <div className="mt-4 inline-flex rounded-2xl border border-orange-500/20 bg-orange-500/10 px-4 py-2 text-sm font-semibold text-orange-100">
                Viewing: {selectedOfficeName}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setCreateRuleOpen(true)}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10"
              >
                <Plus size={16} />
                New Leave Rule
              </button>

              <button
                type="button"
                onClick={() => setCreateTypeOpen(true)}
                className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black hover:bg-orange-400"
              >
                <Plus size={16} />
                New Leave Type
              </button>
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-white/60 sm:px-6">
              Loading leave review data...
            </div>
          ) : (
            <>
              {error ? (
                <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-red-300">
                  {error}
                </div>
              ) : null}

              {successMessage ? (
                <div className="mb-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-6 text-emerald-300">
                  {successMessage}
                </div>
              ) : null}

              <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 xl:col-span-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-white/60">Total Requests</p>
                    <CalendarDays size={18} className="text-orange-500" />
                  </div>
                  <p className="mt-4 text-3xl font-bold text-white">
                    {filteredRequests.length}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-white/60">Pending</p>
                    <ShieldCheck size={18} className="text-amber-400" />
                  </div>
                  <p className="mt-4 text-3xl font-bold text-amber-300">
                    {pendingCount}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-white/60">Approved This Month</p>
                    <ShieldCheck size={18} className="text-emerald-400" />
                  </div>
                  <p className="mt-4 text-3xl font-bold text-emerald-300">
                    {approvedThisMonthCount}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-white/60">On Leave Today</p>
                    <CalendarDays size={18} className="text-orange-400" />
                  </div>
                  <p className="mt-4 text-3xl font-bold text-orange-300">
                    {staffOnLeaveTodayCount}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-white/60">Requests by Office</p>
                    <Unlock size={18} className="text-emerald-400" />
                  </div>
                  <div className="mt-4 space-y-1 text-sm text-white/75">
                    {officeCounts.map((item) => (
                      <p key={item.office} className="flex justify-between gap-3">
                        <span>{item.office}</span>
                        <span className="font-semibold text-white">{item.count}</span>
                      </p>
                    ))}
                  </div>
                </div>
              </section>

              <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <p className="text-sm text-white/60">Balanced Leave Days</p>
                  <p className="mt-4 text-3xl font-bold text-white">
                    {balanceSummary.total}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <p className="text-sm text-white/60">Remaining Leave Days</p>
                  <p className="mt-4 text-3xl font-bold text-emerald-300">
                    {balanceSummary.remaining}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <p className="text-sm text-white/60">Pending Days</p>
                  <p className="mt-4 text-3xl font-bold text-orange-300">
                    {pendingDays}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <p className="text-sm text-white/60">Balance Adjustments</p>
                  <p className="mt-4 text-3xl font-bold text-white">
                    {balanceHistory.length}
                  </p>
                </div>
              </section>

              <section className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">Calendar Filters</h2>
                    <p className="mt-1 text-sm text-white/50">
                      {selectedOfficeId === "all"
                        ? "Showing all office rules."
                        : getLeaveCountingRuleLabel(selectedOfficeName)}
                    </p>
                  </div>
                  <div className="text-sm text-white/45">
                    Approved {approvedCount} · Rejected {rejectedCount} · Closed rules{" "}
                    {closedRulesCount} · Open rules {openRulesCount}
                  </div>
                </div>

                <div className="mb-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <p className="text-sm font-semibold text-white">Requests by status</p>
                    <div className="mt-3 space-y-1 text-sm text-white/65">
                      {requestsByStatus.map((item) => (
                        <p key={item.status} className="flex justify-between capitalize">
                          <span>{item.status}</span>
                          <span className="font-semibold text-white">{item.count}</span>
                        </p>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <p className="text-sm font-semibold text-white">Requests by leave type</p>
                    <div className="mt-3 space-y-1 text-sm text-white/65">
                      {leaveTypeCounts.length === 0 ? (
                        <p>No leave types created yet.</p>
                      ) : (
                        leaveTypeCounts.map((item) => (
                          <p key={item.name} className="flex justify-between">
                            <span>{item.name}</span>
                            <span className="font-semibold text-white">{item.count}</span>
                          </p>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-white/40">
                      Office
                    </span>
                    <select
                      value={selectedOfficeId}
                      onChange={(event) => {
                        setSelectedOfficeId(event.target.value);
                        setEmployeeFilter("all");
                      }}
                      className="w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none focus:border-orange-400/70"
                    >
                      <option value="all">All Offices</option>
                      {officeSelectOptions.map((office) => (
                        <option key={office.id} value={office.id}>
                          {office.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-white/40">
                      Employee
                    </span>
                    <select
                      value={employeeFilter}
                      onChange={(event) => setEmployeeFilter(event.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none focus:border-orange-400/70"
                    >
                      <option value="all">All employees</option>
                      {employeeOptions.map(([userId, label]) => (
                        <option key={userId} value={userId}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-white/40">
                      Leave type
                    </span>
                    <select
                      value={leaveTypeFilter}
                      onChange={(event) => setLeaveTypeFilter(event.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none focus:border-orange-400/70"
                    >
                      <option value="all">All leave types</option>
                      {leaveTypes.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-white/40">
                      From
                    </span>
                    <input
                      type="date"
                      value={rangeStartFilter}
                      onChange={(event) => setRangeStartFilter(event.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none focus:border-orange-400/70"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-white/40">
                      To
                    </span>
                    <input
                      type="date"
                      value={rangeEndFilter}
                      onChange={(event) => setRangeEndFilter(event.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none focus:border-orange-400/70"
                    />
                  </label>
                </div>
              </section>

              {selectedOfficeId !== "all" && balanceEmployees.length === 0 ? (
                <div className="mb-6 rounded-2xl border border-white/10 bg-black/30 px-4 py-6 text-white/55 sm:px-6">
                  No workers found for this office.
                </div>
              ) : null}

              <section className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="mb-4 flex items-center gap-3">
                  <CalendarDays size={18} className="text-orange-500" />
                  <h2 className="text-lg font-semibold">Leave Calendar</h2>
                </div>

                <LeaveCalendar
                  approvedLeaves={filteredCalendarLeaves}
                  rules={rules}
                  holidays={holidays}
                  canManage={true}
                  onMoveEvent={handleMoveApprovedLeave}
                  officeFilter={selectedOfficeId === "all" ? "all" : selectedOfficeName}
                />
              </section>

              <section className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="mb-4 flex items-center gap-3">
                  <CalendarDays size={18} className="text-orange-500" />
                  <h2 className="text-lg font-semibold">Leave Rules</h2>
                </div>

                <LeaveRuleList
                  rules={rules}
                  onDelete={(ruleId) => void handleDeleteRule(ruleId)}
                  deletingId={deletingRuleId}
                />
              </section>

              {canAdjustLeaveBalances ? (
                <LeaveBalanceAdjustmentCard
                  employees={balanceEmployees}
                  history={balanceHistory}
                  saving={balanceSaving}
                  onSave={handleSaveBalanceModification}
                />
              ) : null}

              <section className="mb-6 grid gap-6 xl:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 xl:col-span-2">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <CalendarDays size={18} className="text-orange-500" />
                      <h2 className="text-lg font-semibold">
                        Submitted Requests
                      </h2>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {(
                        ["all", "pending", "approved", "rejected"] as const
                      ).map((filter) => (
                        <button
                          key={filter}
                          type="button"
                          onClick={() => setActiveFilter(filter)}
                          className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                            activeFilter === filter
                              ? "bg-orange-500 text-black"
                              : "border border-white/10 bg-black/30 text-white/70 hover:bg-white/5 hover:text-white"
                          }`}
                        >
                          {filter.charAt(0).toUpperCase() + filter.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {filteredRequests.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-6 text-white/55 sm:px-6">
                      {selectedOfficeId === "all"
                        ? "No leave requests found for the selected filter."
                        : "No leave requests found for this office."}
                    </div>
                  ) : (
                    <LeaveRequestTable
                      requests={filteredRequests}
                      onApprove={handleApprove}
                      onReject={handleReject}
                      onModifyDates={handleModifyLeaveDates}
                      actionLoadingId={actionLoadingId}
                    />
                  )}
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h2 className="text-lg font-semibold">Leave Types</h2>
                  <div className="mt-4 space-y-3">
                    {leaveTypes.length === 0 ? (
                      <p className="text-sm text-white/50">
                        No leave types created yet.
                      </p>
                    ) : (
                      leaveTypes.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl border border-white/10 bg-black/30 px-4 py-3"
                        >
                          <p className="font-medium text-white">{item.name}</p>
                          <p className="mt-1 text-sm text-white/60">
                            Default days: {item.default_days}
                          </p>
                          {item.description ? (
                            <p className="mt-1 text-xs text-white/45">
                              {item.description}
                            </p>
                          ) : null}
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

      <CreateLeaveTypeModal
        open={createTypeOpen}
        onClose={() => setCreateTypeOpen(false)}
        organizationId={organizationId}
        onCreated={loadPage}
      />

      <CreateLeaveRuleModal
        open={createRuleOpen}
        onClose={() => setCreateRuleOpen(false)}
        organizationId={organizationId}
        userId={userId}
        onCreated={loadPage}
      />

      <ModifyLeaveRequestModal
        open={modifyLeaveOpen}
        onClose={() => {
          setModifyLeaveOpen(false);
          setSelectedLeaveForModify(null);
        }}
        leaveRequest={selectedLeaveForModify}
        organizationId={organizationId}
        onSave={handleSaveLeaveModification}
      />

    </div>
  );
}
