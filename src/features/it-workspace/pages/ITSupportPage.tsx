import { useCallback, useEffect, useState } from "react";
import {
  Shield,
  Plus,
  KeyRound,
  Lock,
  ShieldAlert,
  Smartphone,
  UserCog,
  HelpCircle,
  X,
  Loader2,
} from "lucide-react";
import { useAuth } from "../../../app/providers/AuthProvider";
import Sidebar from "../../../components/dashboard/components/Siderbar";
import SupportTicketsFeed from "../components/SupportTicketsFeed";
import {
  getSupportTickets,
  getSupportTicketStats,
  createSupportTicket,
  updateTicketStatus,
  assignTicket,
  type SupportTicket,
  type SupportTicketStats,
  type TicketType,
  type TicketPriority,
  type TicketStatus,
} from "../services/supportTicketService";

const ticketTypeOptions: {
  value: TicketType;
  label: string;
  icon: typeof KeyRound;
}[] = [
  { value: "account_recovery", label: "Account Recovery", icon: KeyRound },
  { value: "password_reset", label: "Password Reset", icon: Lock },
  { value: "account_unlock", label: "Account Unlock", icon: Lock },
  { value: "mfa_reset", label: "MFA Reset", icon: Smartphone },
  { value: "access_request", label: "Access Request", icon: ShieldAlert },
  { value: "permission_change", label: "Permission Change", icon: UserCog },
  { value: "device_issue", label: "Device Issue", icon: Smartphone },
  { value: "other", label: "Other", icon: HelpCircle },
];

const priorityOptions: { value: TicketPriority; label: string }[] = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const statusFilterOptions: { value: TicketStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting_on_user", label: "Waiting" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

export default function ITSupportPage() {
  const auth = useAuth();
  const user = auth?.user ?? null;
  const profile = auth?.profile ?? null;
  const loading = auth?.loading ?? true;
  const organizationId = profile?.organization_id ?? null;
  const userId = user?.id ?? undefined;

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [stats, setStats] = useState<SupportTicketStats | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all");

  // Create ticket modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newType, setNewType] = useState<TicketType>("account_recovery");
  const [newPriority, setNewPriority] = useState<TicketPriority>("medium");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newRequesterEmail, setNewRequesterEmail] = useState("");

  // Detail panel state
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(
    null,
  );
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [updating, setUpdating] = useState(false);

  const loadData = useCallback(async () => {
    if (!organizationId) return;
    try {
      setPageLoading(true);
      setPageError("");
      const filterStatus = statusFilter === "all" ? undefined : [statusFilter];
      const [ticketsResult, statsResult] = await Promise.all([
        getSupportTickets(organizationId, { status: filterStatus }),
        getSupportTicketStats(organizationId),
      ]);
      setTickets(ticketsResult);
      setStats(statsResult);
    } catch (err: any) {
      setPageError(err?.message || "Failed to load support tickets.");
    } finally {
      setPageLoading(false);
    }
  }, [organizationId, statusFilter]);

  useEffect(() => {
    if (organizationId) void loadData();
  }, [organizationId, loadData]);

  async function handleCreate() {
    if (!organizationId || !userId || !newTitle.trim()) return;
    try {
      setCreating(true);
      await createSupportTicket({
        organizationId,
        requesterId: userId,
        requesterEmail: newRequesterEmail || undefined,
        ticketType: newType,
        priority: newPriority,
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
      });
      setCreateOpen(false);
      setNewTitle("");
      setNewDescription("");
      setNewRequesterEmail("");
      setNewType("account_recovery");
      setNewPriority("medium");
      await loadData();
    } catch (err: any) {
      setPageError(err?.message || "Failed to create ticket.");
    } finally {
      setCreating(false);
    }
  }

  async function handleStatusChange(ticketId: string, newStatus: TicketStatus) {
    try {
      setUpdating(true);
      await updateTicketStatus(
        ticketId,
        newStatus,
        resolutionNotes || undefined,
      );
      setSelectedTicket(null);
      setResolutionNotes("");
      await loadData();
    } catch (err: any) {
      setPageError(err?.message || "Failed to update ticket.");
    } finally {
      setUpdating(false);
    }
  }

  async function handleAssignToMe(ticketId: string) {
    if (!userId) return;
    try {
      setUpdating(true);
      await assignTicket(ticketId, userId);
      setSelectedTicket(null);
      await loadData();
    } catch (err: any) {
      setPageError(err?.message || "Failed to assign ticket.");
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black p-6 text-white">
        Loading IT Support...
      </div>
    );
  }

  if (!user || !profile || !organizationId || !userId) {
    return (
      <div className="min-h-screen bg-black p-6 text-white">
        Unable to load IT Support.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen">
        <Sidebar
          role={profile.primary_role}
          counts={{
            projects: 0,
            pendingInvites: 0,
            openIssues: 0,
          }}
        />

        <main className="min-w-0 flex-1 p-6 lg:p-8">
          {/* Header */}
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Shield size={14} className="text-orange-500" />
                <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
                  IT Support & Account Recovery
                </p>
              </div>
              <h1 className="mt-2 text-3xl font-bold">Support Tickets</h1>
              <p className="mt-2 text-sm text-white/50">
                Account recovery, password resets, access requests, and IT
                support tracking.
              </p>
            </div>
            <button
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black hover:bg-orange-400"
            >
              <Plus size={16} /> New Ticket
            </button>
          </div>

          {/* Stats */}
          {stats && (
            <div className="mb-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { label: "Open", value: stats.open, color: "text-amber-400" },
                {
                  label: "In Progress",
                  value: stats.inProgress,
                  color: "text-blue-400",
                },
                {
                  label: "Waiting",
                  value: stats.waitingOnUser,
                  color: "text-purple-400",
                },
                {
                  label: "Resolved",
                  value: stats.resolved,
                  color: "text-emerald-400",
                },
                { label: "Urgent", value: stats.urgent, color: "text-red-400" },
                {
                  label: "Account Recovery",
                  value: stats.accountRecovery,
                  color: "text-orange-400",
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl border border-white/10 bg-white/5 p-4 text-center"
                >
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="mt-1 text-[10px] text-white/40">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Filters */}
          <div className="mb-4 flex gap-2">
            {statusFilterOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  statusFilter === opt.value
                    ? "bg-orange-500 text-black"
                    : "border border-white/10 bg-white/5 text-white/60 hover:text-white"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {pageError && (
            <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
              {pageError}
            </div>
          )}

          {/* Ticket List */}
          <div className="grid gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2">
              {pageLoading ? (
                <SupportTicketsFeed tickets={[]} loading />
              ) : (
                <div className="space-y-2">
                  {tickets.length === 0 ? (
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 text-center">
                      <p className="text-sm text-emerald-400">
                        No tickets match your filter
                      </p>
                    </div>
                  ) : (
                    tickets.map((ticket) => (
                      <button
                        key={ticket.id}
                        onClick={() => {
                          setSelectedTicket(ticket);
                          setResolutionNotes(ticket.resolution_notes ?? "");
                        }}
                        className={`group flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all hover:border-orange-500/30 ${
                          selectedTicket?.id === ticket.id
                            ? "border-orange-500/40 bg-orange-500/5"
                            : "border-white/10 bg-white/5"
                        }`}
                      >
                        <div className="mt-0.5 shrink-0 rounded-lg bg-white/5 p-1.5">
                          {(() => {
                            const Icon =
                              ticketTypeOptions.find(
                                (o) => o.value === ticket.ticket_type,
                              )?.icon ?? HelpCircle;
                            return (
                              <Icon size={14} className="text-orange-400" />
                            );
                          })()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium text-white">
                              {ticket.title}
                            </p>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                ticket.priority === "urgent"
                                  ? "bg-red-500/20 text-red-300"
                                  : ticket.priority === "high"
                                    ? "bg-orange-500/20 text-orange-300"
                                    : "bg-white/10 text-white/50"
                              }`}
                            >
                              {ticket.priority}
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-white/45">
                            <span>{ticket.status.replace(/_/g, " ")}</span>
                            <span>•</span>
                            <span>
                              {ticket.requester_name ??
                                ticket.requester_email ??
                                "Unknown"}
                            </span>
                            <span>•</span>
                            <span>{ticket.ticket_type.replace(/_/g, " ")}</span>
                          </div>
                        </div>
                        <span className="shrink-0 text-[10px] text-white/30">
                          {new Date(ticket.created_at).toLocaleDateString()}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Detail Panel */}
            <div>
              {selectedTicket ? (
                <div className="sticky top-6 rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="mb-4 flex items-start justify-between">
                    <h3 className="text-sm font-semibold text-white">
                      Ticket Details
                    </h3>
                    <button
                      onClick={() => setSelectedTicket(null)}
                      className="text-white/30 hover:text-white"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <p className="text-white/40">Title</p>
                      <p className="mt-0.5 text-white">
                        {selectedTicket.title}
                      </p>
                    </div>
                    <div>
                      <p className="text-white/40">Type</p>
                      <p className="mt-0.5 capitalize text-white">
                        {selectedTicket.ticket_type.replace(/_/g, " ")}
                      </p>
                    </div>
                    <div>
                      <p className="text-white/40">Requester</p>
                      <p className="mt-0.5 text-white">
                        {selectedTicket.requester_name ??
                          selectedTicket.requester_email ??
                          "Unknown user"}
                      </p>
                    </div>
                    <div>
                      <p className="text-white/40">Assigned To</p>
                      <p className="mt-0.5 text-white">
                        {selectedTicket.assigned_name ?? "Unassigned"}
                      </p>
                    </div>
                    <div>
                      <p className="text-white/40">Status</p>
                      <p className="mt-0.5 capitalize text-white">
                        {selectedTicket.status.replace(/_/g, " ")}
                      </p>
                    </div>
                    <div>
                      <p className="text-white/40">Priority</p>
                      <p className="mt-0.5 capitalize text-white">
                        {selectedTicket.priority}
                      </p>
                    </div>
                    {selectedTicket.description && (
                      <div>
                        <p className="text-white/40">Description</p>
                        <p className="mt-0.5 whitespace-pre-wrap text-white/70">
                          {selectedTicket.description}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-white/40">Created</p>
                      <p className="mt-0.5 text-white">
                        {new Date(selectedTicket.created_at).toLocaleString()}
                      </p>
                    </div>
                    {selectedTicket.resolved_at && (
                      <div>
                        <p className="text-white/40">Resolved</p>
                        <p className="mt-0.5 text-white">
                          {new Date(
                            selectedTicket.resolved_at,
                          ).toLocaleString()}
                        </p>
                      </div>
                    )}

                    {/* Resolution Notes */}
                    <div>
                      <p className="mb-1 text-white/40">Resolution Notes</p>
                      <textarea
                        value={resolutionNotes}
                        onChange={(e) => setResolutionNotes(e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white placeholder-white/30 focus:border-orange-500/40 focus:outline-none"
                        rows={3}
                        placeholder="Add resolution notes..."
                      />
                    </div>

                    {/* Actions */}
                    <div className="space-y-2 pt-2">
                      {!selectedTicket.assigned_to && (
                        <button
                          onClick={() => handleAssignToMe(selectedTicket.id)}
                          disabled={updating}
                          className="w-full rounded-xl bg-blue-500/20 px-3 py-2 text-xs font-medium text-blue-300 hover:bg-blue-500/30 disabled:opacity-50"
                        >
                          {updating ? "Assigning..." : "Assign to Me"}
                        </button>
                      )}
                      {selectedTicket.status !== "resolved" &&
                        selectedTicket.status !== "closed" && (
                          <>
                            {selectedTicket.status !== "in_progress" && (
                              <button
                                onClick={() =>
                                  handleStatusChange(
                                    selectedTicket.id,
                                    "in_progress",
                                  )
                                }
                                disabled={updating}
                                className="w-full rounded-xl bg-amber-500/20 px-3 py-2 text-xs font-medium text-amber-300 hover:bg-amber-500/30 disabled:opacity-50"
                              >
                                Mark In Progress
                              </button>
                            )}
                            <button
                              onClick={() =>
                                handleStatusChange(
                                  selectedTicket.id,
                                  "waiting_on_user",
                                )
                              }
                              disabled={updating}
                              className="w-full rounded-xl bg-purple-500/20 px-3 py-2 text-xs font-medium text-purple-300 hover:bg-purple-500/30 disabled:opacity-50"
                            >
                              Waiting on User
                            </button>
                            <button
                              onClick={() =>
                                handleStatusChange(
                                  selectedTicket.id,
                                  "resolved",
                                )
                              }
                              disabled={updating}
                              className="w-full rounded-xl bg-emerald-500/20 px-3 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50"
                            >
                              {updating ? "Resolving..." : "Resolve Ticket"}
                            </button>
                          </>
                        )}
                      {selectedTicket.status === "resolved" && (
                        <button
                          onClick={() =>
                            handleStatusChange(selectedTicket.id, "closed")
                          }
                          disabled={updating}
                          className="w-full rounded-xl bg-white/10 px-3 py-2 text-xs font-medium text-white/60 hover:bg-white/20 disabled:opacity-50"
                        >
                          Close Ticket
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
                  <p className="text-sm text-white/40">
                    Select a ticket to view details and take action
                  </p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Create Ticket Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-900 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                New Support Ticket
              </h2>
              <button
                onClick={() => setCreateOpen(false)}
                className="text-white/30 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs text-white/50">
                  Ticket Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {ticketTypeOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setNewType(opt.value)}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs transition-colors ${
                        newType === opt.value
                          ? "border-orange-500/40 bg-orange-500/10 text-orange-300"
                          : "border-white/10 bg-white/5 text-white/60 hover:text-white"
                      }`}
                    >
                      <opt.icon size={12} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs text-white/50">
                  Priority
                </label>
                <div className="flex gap-2">
                  {priorityOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setNewPriority(opt.value)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                        newPriority === opt.value
                          ? "bg-orange-500 text-black"
                          : "border border-white/10 bg-white/5 text-white/60"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs text-white/50">
                  Title
                </label>
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white placeholder-white/30 focus:border-orange-500/40 focus:outline-none"
                  placeholder="e.g. Account recovery for john@company.com"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-white/50">
                  Requester Email (if user is locked out)
                </label>
                <input
                  value={newRequesterEmail}
                  onChange={(e) => setNewRequesterEmail(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white placeholder-white/30 focus:border-orange-500/40 focus:outline-none"
                  placeholder="user@company.com"
                  type="email"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-white/50">
                  Description
                </label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white placeholder-white/30 focus:border-orange-500/40 focus:outline-none"
                  rows={3}
                  placeholder="Describe the issue..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setCreateOpen(false)}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/60 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating || !newTitle.trim()}
                  className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-orange-400 disabled:opacity-50"
                >
                  {creating && <Loader2 size={14} className="animate-spin" />}
                  Create Ticket
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
