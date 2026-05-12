import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CalendarDays,
  Camera,
  CheckCircle2,
  Clock3,
  FileText,
  Plus,
  Search,
  Sparkles,
  Timer,
  User,
  X,
} from "lucide-react";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import { useAuth } from "../../../app/providers/AuthProvider";
import {
  getMediaDashboardData,
  getMediaInitials,
  type MediaCreativeRequest,
  type MediaProfile,
} from "../services/mediaDashboardService";

const REQUEST_TYPES = [
  "poster",
  "video",
  "reel",
  "flyer",
  "campaign_creatives",
  "photography",
  "event_coverage",
] as const;

const REQUEST_STATUSES = [
  "requested",
  "planning",
  "shooting",
  "editing",
  "review",
  "approved",
  "delivered",
] as const;

const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

function StatusBadge({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const color = normalized.includes("overdue") || normalized.includes("urgent")
    ? "border-red-500/20 bg-red-500/10 text-red-300"
    : normalized.includes("review") || normalized.includes("approval")
      ? "border-amber-500/20 bg-amber-500/10 text-amber-300"
      : normalized.includes("done") || normalized.includes("delivered") || normalized.includes("approved")
        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
        : "border-white/10 bg-white/5 text-white/65";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${color}`}>
      {value.replaceAll("_", " ")}
    </span>
  );
}

function PriorityBadge({ value }: { value: string }) {
  const color = value === "urgent"
    ? "border-red-500/20 bg-red-500/10 text-red-300"
    : value === "high"
      ? "border-orange-500/20 bg-orange-500/10 text-orange-300"
      : value === "medium"
        ? "border-yellow-500/20 bg-yellow-500/10 text-yellow-300"
        : "border-white/10 bg-white/5 text-white/65";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${color}`}>
      {value}
    </span>
  );
}

function EmptyState({ children }: { children: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-black/30 p-8 text-center text-sm text-white/45">
      {children}
    </div>
  );
}

function RequestCard({ request }: { request: MediaCreativeRequest }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-950 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h3 className="truncate text-lg font-semibold text-white">{request.title}</h3>
            <PriorityBadge value={request.priority} />
          </div>
          
          <p className="mt-2 text-sm text-white/60 line-clamp-2">{request.description}</p>
          
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge value={request.status} />
            <span className="rounded-full bg-purple-500/10 px-2.5 py-1 text-xs font-semibold text-purple-300">
              {request.request_type.replaceAll("_", " ")}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-white/40">Requested by</p>
              <div className="mt-1 flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-500/20 text-[10px] font-bold text-purple-200">
                  {getMediaInitials(request.requester.full_name, request.requester.email)}
                </div>
                <span className="text-white/70">{request.requester.full_name || request.requester.email}</span>
              </div>
            </div>
            
            <div>
              <p className="text-white/40">Assigned to</p>
              <div className="mt-1 flex items-center gap-2">
                {request.assigned_to ? (
                  <>
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500/20 text-[10px] font-bold text-orange-200">
                      {getMediaInitials(request.assigned_to.full_name, request.assigned_to.email)}
                    </div>
                    <span className="text-white/70">{request.assigned_to.full_name || request.assigned_to.email}</span>
                  </>
                ) : (
                  <span className="text-white/40">Unassigned</span>
                )}
              </div>
            </div>
          </div>

          {request.deadline && (
            <div className="mt-3 flex items-center gap-2 text-sm">
              <CalendarDays size={14} className="text-white/40" />
              <span className="text-white/60">Deadline: {new Date(request.deadline).toLocaleDateString()}</span>
            </div>
          )}

          {request.attached_files.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-white/40">Attachments</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {request.attached_files.map((file) => (
                  <a
                    key={file.id}
                    href={file.file_url || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70 hover:bg-white/10"
                  >
                    <FileText size={12} />
                    {file.file_name}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-2">
          <button
            type="button"
            className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/70 hover:bg-white/10"
            title="Edit request"
          >
            <Timer size={16} />
          </button>
          <button
            type="button"
            className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/70 hover:bg-white/10"
            title="View details"
          >
            <Search size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CreativeRequestsPage() {
  const auth = useAuth();
  const profile = auth?.profile ?? null;
  const [requests, setRequests] = useState<MediaCreativeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const loadRequests = useCallback(async () => {
    if (!profile?.organization_id || !profile.id) return;
    try {
      setLoading(true);
      setError("");
      // For now, we'll use the existing dashboard data
      // In a full implementation, this would be a dedicated API call
      const data = await getMediaDashboardData({
        id: profile.id,
        organization_id: profile.organization_id,
        office_id: profile.office_id,
        primary_role: profile.primary_role,
        office: profile.office as { is_primary?: boolean | null } | null,
      });
      setRequests(data.creativeRequests);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load creative requests.");
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const filteredRequests = requests.filter((request) => {
    const matchesSearch = !searchTerm || 
      request.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (request.description?.toLowerCase().includes(searchTerm.toLowerCase()) || false);
    
    const matchesStatus = statusFilter === "all" || request.status === statusFilter;
    const matchesType = typeFilter === "all" || request.request_type === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  if (!profile) {
    return <div className="min-h-screen bg-black p-6 text-white">Loading profile...</div>;
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <Sidebar role={profile.primary_role} />
        
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-orange-500">Media Operations</p>
              <h1 className="mt-2 text-3xl font-bold">Creative Requests</h1>
              <p className="mt-2 text-sm text-white/50">
                Manage creative requests from departments and clients for posters, videos, photography, and more.
              </p>
            </div>
            
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 rounded-2xl border border-white/10 bg-orange-500 px-4 py-3 text-sm font-semibold text-black hover:bg-orange-400"
            >
              <Plus size={16} />
              New Request
            </button>
          </div>

          <div className="mb-6 flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="text"
                  placeholder="Search requests..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/30 pl-10 pr-4 py-3 text-white placeholder-white/40 focus:border-orange-500/50 focus:outline-none"
                />
              </div>
            </div>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white focus:border-orange-500/50 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              {REQUEST_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll("_", " ")}
                </option>
              ))}
            </select>
            
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white focus:border-orange-500/50 focus:outline-none"
            >
              <option value="all">All Types</option>
              {REQUEST_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/60">
              Loading creative requests...
            </div>
          ) : error ? (
            <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-red-200">
              {error}
            </div>
          ) : filteredRequests.length === 0 ? (
            <EmptyState>
              {searchTerm || statusFilter !== "all" || typeFilter !== "all"
                ? "No creative requests match your filters."
                : "No creative requests found. Create a new request to get started."}
            </EmptyState>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm text-white/50">
                <span>{filteredRequests.length} creative request{filteredRequests.length !== 1 ? "s" : ""}</span>
                <button
                  type="button"
                  onClick={() => void loadRequests()}
                  className="flex items-center gap-1 text-orange-400 hover:text-orange-300"
                >
                  <Timer size={14} />
                  Refresh
                </button>
              </div>
              
              <div className="grid gap-4">
                {filteredRequests.map((request) => (
                  <RequestCard key={request.id} request={request} />
                ))}
              </div>
            </div>
          )}

          {showCreateModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
              <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-black p-6">
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-xl font-bold">Create Creative Request</h2>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="rounded-lg p-2 text-white/60 hover:bg-white/10"
                  >
                    <X size={20} />
                  </button>
                </div>
                
                <div className="text-center text-sm text-white/50">
                  Creative request creation form would be implemented here with fields for:
                  title, description, request type, priority, deadline, attachments, and assignment.
                </div>
                
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="rounded-xl border border-white/10 px-4 py-2 text-white/70 hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled
                    className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-black opacity-50"
                  >
                    Create Request
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
