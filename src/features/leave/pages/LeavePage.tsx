import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Plus } from "lucide-react";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import { useAuth } from "../../../../src/app/providers/AuthProvider";
import CreateLeaveRequestModal from "../components/CreateLeaveRequestModal";
import MyLeaveRequestsTable from "../components/MyLeaveRequestsTable";
import LeaveCalendar from "../components/leaveCalender";
import {
  getLeaveTypes,
  getMyLeaveRequests,
  type LeaveTypeRow,
  type MyLeaveRequestRow,
} from "../services/leaveService";
import {
  getApprovedLeaveCalendarEvents,
  getLeaveCalendarRules,
  type LeaveCalendarEventRow,
  type LeaveCalendarRuleRow,
} from "../services/leaveCalendarService";

const LEAVE_OFFICE_OPTIONS = ["Three Little Birds", "ITsNomatata", ];

export default function LeavePage() {
  const auth = useAuth();
  const user = auth?.user ?? null;
  const profile = auth?.profile ?? null;
  const authLoading = auth?.loading ?? true;

  const organizationId = profile?.organization_id ?? null;
  const userId = user?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeRow[]>([]);
  const [requests, setRequests] = useState<MyLeaveRequestRow[]>([]);
  const [approvedLeaves, setApprovedLeaves] = useState<LeaveCalendarEventRow[]>(
    [],
  );
  const [rules, setRules] = useState<LeaveCalendarRuleRow[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const loadPage = useCallback(async () => {
    if (!organizationId || !userId) return;

    try {
      setLoading(true);
      setError("");

      const [leaveTypesData, requestsData, approvedLeavesData, rulesData] =
        await Promise.all([
          getLeaveTypes(organizationId),
          getMyLeaveRequests(organizationId, userId),
          getApprovedLeaveCalendarEvents(organizationId),
          getLeaveCalendarRules(organizationId),
        ]);

      setLeaveTypes(leaveTypesData);
      setRequests(requestsData);
      setApprovedLeaves(approvedLeavesData);
      setRules(rulesData);
    } catch (err: any) {
      console.error("LEAVE PAGE LOAD ERROR:", err);
      setError(err?.message || "Failed to load leave page.");
    } finally {
      setLoading(false);
    }
  }, [organizationId, userId]);

  useEffect(() => {
    if (!organizationId || !userId) return;
    void loadPage();
  }, [organizationId, userId, loadPage]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black p-6 text-white">
        Loading leave page...
      </div>
    );
  }

  if (!user || !profile || !organizationId || !userId) {
    return (
      <div className="min-h-screen bg-black p-6 text-white">
        Missing leave workspace context.
      </div>
    );}
return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen">
        <Sidebar role={profile.primary_role} />

        <main className="flex-1 p-6 lg:p-8">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
                Workspace
              </p>
              <h1 className="mt-2 text-3xl font-bold">My Leave</h1>
              <p className="mt-2 text-sm text-white/50">
                Submit leave requests, view the leave calendar, and check who is
                already on leave.
              </p>
            </div>

            <button
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black hover:bg-orange-400"
            >
              <Plus size={16} />
              Request Leave
            </button>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/60">
              Loading leave requests...
            </div>
          ) : error ? (
            <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-red-300">
              {error}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="mb-4 flex items-center gap-3">
                  <CalendarDays size={18} className="text-orange-500" />
                  <h2 className="text-lg font-semibold">Leave Calendar</h2>
                </div>

                <LeaveCalendar approvedLeaves={approvedLeaves} rules={rules} />
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="mb-4 flex items-center gap-3">
                  <CalendarDays size={18} className="text-orange-500" />
                  <h2 className="text-lg font-semibold">My Leave Requests</h2>
                </div>

                <MyLeaveRequestsTable
                  requests={requests}
                  leaveTypes={leaveTypes}
                />
              </div>
            </div>
          )}
        </main>
      </div>

      <CreateLeaveRequestModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        organizationId={organizationId}
        userId={userId}
        leaveTypes={leaveTypes}
        officeOptions={LEAVE_OFFICE_OPTIONS}
        defaultOffice={
          typeof profile.department === "string" ? profile.department : ""
        }
        requesterRole={
          typeof profile.primary_role === "string" ? profile.primary_role : null
        }
        onCreated={loadPage}
      />
    </div>
  );
}
