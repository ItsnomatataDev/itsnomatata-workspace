import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Plus, ShieldCheck, Lock, Unlock } from "lucide-react";
import Sidebar from "../../../components/dashboard/components/Siderbar";
import { useAuth } from "../../../app/providers/AuthProvider";
import LeaveRequestTable from "../components/LeaveRequestTable";
import CreateLeaveTypeModal from "../components/CreateLeaveTypeModal";
import CreateLeaveRuleModal from "../../leave/components/CreateLeaveRuleModal";
import LeaveCalendar from "../../leave/components/leaveCalender";
import LeaveRuleList from "../../leave/components/LeaveRuleList";
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
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeRow[]>([]);
  const [approvedLeaves, setApprovedLeaves] = useState<LeaveCalendarEventRow[]>(
    [],
  );
  const [rules, setRules] = useState<LeaveCalendarRuleRow[]>([]);
  const [createTypeOpen, setCreateTypeOpen] = useState(false);
  const [createRuleOpen, setCreateRuleOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<
    "all" | "pending" | "approved" | "rejected"
  >("all");

  const loadPage = useCallback(async () => {
    if (!organizationId) return;

    try {
      setLoading(true);
      setError("");

      const [requestsData, leaveTypesData, approvedLeavesData, rulesData] =
        await Promise.all([
          getLeaveRequests(organizationId),
          getLeaveTypes(organizationId),
          getApprovedLeaveCalendarEvents(organizationId),
          getLeaveCalendarRules(organizationId),
        ]);

      setRequests(requestsData);
      setLeaveTypes(leaveTypesData);
      setApprovedLeaves(approvedLeavesData);
      setRules(rulesData);
    } catch (err: any) {
      console.error("ADMIN LEAVE LOAD ERROR:", err);
      setError(err?.message || "Failed to load leave management.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

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
    if (!organizationId) return;

    try {
      setError("");
      setSuccessMessage("");

      const startDate = formatDateForDb(params.start);
      const endDate = formatDateForDb(params.end);

      await updateApprovedLeaveEventDates({
        leaveRequestId: params.eventId,
        organizationId,
        startDate,
        endDate,
      });

      setSuccessMessage("Approved leave dates updated on the calendar.");
      await loadPage();
    } catch (err: any) {
      console.error("MOVE APPROVED LEAVE ERROR:", err);
      setError(err?.message || "Failed to move approved leave event.");
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
    if (activeFilter === "all") return requests;
    return requests.filter((request) => request.status === activeFilter);
  }, [requests, activeFilter]);

  const pendingCount = requests.filter(
    (item) => item.status === "pending",
  ).length;
  const approvedCount = requests.filter(
    (item) => item.status === "approved",
  ).length;
  const rejectedCount = requests.filter(
    (item) => item.status === "rejected",
  ).length;

  const closedRulesCount = rules.filter(
    (rule) => rule.rule_type === "closed",
  ).length;
  const openRulesCount = rules.filter(
    (rule) => rule.rule_type === "open",
  ).length;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black p-6 text-white">
        Loading leave review...
      </div>
    );
  }

  if (!user || !profile || !organizationId || !userId) {
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

        <main className="min-w-0 flex-1 p-6 lg:p-8">
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
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/60">
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
                    {requests.length}
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
                    <p className="text-sm text-white/60">Approved</p>
                    <ShieldCheck size={18} className="text-emerald-400" />
                  </div>
                  <p className="mt-4 text-3xl font-bold text-emerald-300">
                    {approvedCount}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-white/60">Closed Rules</p>
                    <Lock size={18} className="text-red-400" />
                  </div>
                  <p className="mt-4 text-3xl font-bold text-red-300">
                    {closedRulesCount}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-white/60">Open Rules</p>
                    <Unlock size={18} className="text-emerald-400" />
                  </div>
                  <p className="mt-4 text-3xl font-bold text-emerald-300">
                    {openRulesCount}
                  </p>
                </div>
              </section>

              <section className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="mb-4 flex items-center gap-3">
                  <CalendarDays size={18} className="text-orange-500" />
                  <h2 className="text-lg font-semibold">Leave Calendar</h2>
                </div>

                <LeaveCalendar
                  approvedLeaves={approvedLeaves}
                  rules={rules}
                  canManage
                  onMoveEvent={handleMoveApprovedLeave}
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
                    <div className="rounded-2xl border border-white/10 bg-black/30 p-6 text-white/55">
                      No leave requests found for the selected filter.
                    </div>
                  ) : (
                    <LeaveRequestTable
                      requests={filteredRequests}
                      onApprove={handleApprove}
                      onReject={handleReject}
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
    </div>
  );
}
