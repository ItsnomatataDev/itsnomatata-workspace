import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  CheckCircle2,
  Download,
  FileText,
  Package,
  Plus,
  Search,
  Truck,
  User,
  X,
} from "lucide-react";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import { useAuth } from "../../../app/providers/AuthProvider";
import {
  getMediaDashboardData,
  getMediaInitials,
  type MediaDelivery,
} from "../services/mediaDashboardService";

const DELIVERY_TYPES = [
  "final_asset",
  "campaign_package",
  "video_content",
  "image_set",
  "social_media_kit",
] as const;

const DELIVERY_STATUSES = [
  "preparing",
  "delivered",
  "feedback_requested",
  "approved",
  "archived",
] as const;

const FORMATS = [
  "mp4",
  "mov",
  "jpg",
  "png",
  "gif",
  "zip",
  "pdf",
  "psd",
  "ai",
] as const;

function StatusBadge({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const color = normalized.includes("delivered")
    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
    : normalized.includes("feedback") || normalized.includes("review")
      ? "border-amber-500/20 bg-amber-500/10 text-amber-300"
      : normalized.includes("approved") || normalized.includes("archived")
        ? "border-blue-500/20 bg-blue-500/10 text-blue-300"
        : "border-white/10 bg-white/5 text-white/65";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${color}`}>
      {value.replaceAll("_", " ")}
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

function DeliveryCard({ delivery }: { delivery: MediaDelivery }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-950 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h3 className="truncate text-lg font-semibold text-white">{delivery.title}</h3>
            <StatusBadge value={delivery.status} />
          </div>
          
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <span className="rounded-full bg-purple-500/10 px-2.5 py-1 text-xs font-semibold text-purple-300">
              {delivery.delivery_type.replaceAll("_", " ")}
            </span>
            <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-300">
              {delivery.deliverable_format.toUpperCase()}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-white/40">Delivered to</p>
              <p className="mt-1 font-medium text-white">{delivery.delivered_to}</p>
            </div>
            
            <div>
              <p className="text-white/40">Delivery date</p>
              <p className="mt-1 font-medium text-white">
                {delivery.delivery_date 
                  ? new Date(delivery.delivery_date).toLocaleDateString()
                  : "Not delivered yet"
                }
              </p>
            </div>
          </div>

          {delivery.feedback_notes && (
            <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
              <p className="text-xs font-medium text-amber-300">Feedback</p>
              <p className="mt-1 text-sm text-amber-100">{delivery.feedback_notes}</p>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-white/40">
              <Package size={14} />
              <span>Created {new Date(delivery.created_at).toLocaleDateString()}</span>
            </div>
            
            <div className="flex gap-2">
              {delivery.delivery_date && (
                <button
                  type="button"
                  className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 hover:bg-white/10"
                  title="Download delivery"
                >
                  <Download size={12} />
                  Download
                </button>
              )}
              
              <button
                type="button"
                className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 hover:bg-white/10"
                title="View details"
              >
                <FileText size={12} />
                Details
              </button>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center">
          <div className={`rounded-full p-3 ${
            delivery.approval_received 
              ? "bg-emerald-500/20 text-emerald-300" 
              : "bg-amber-500/20 text-amber-300"
          }`}>
            {delivery.approval_received ? <CheckCircle2 size={20} /> : <CalendarDays size={20} />}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DeliveryTrackerPage() {
  const auth = useAuth();
  const profile = auth?.profile ?? null;
  const [deliveries, setDeliveries] = useState<MediaDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const loadDeliveries = useCallback(async () => {
    if (!profile?.organization_id || !profile.id) return;
    try {
      setLoading(true);
      setError("");
      // For now, we'll use existing dashboard data
      // In a full implementation, this would be a dedicated API call
      const data = await getMediaDashboardData({
        id: profile.id,
        organization_id: profile.organization_id,
        office_id: profile.office_id,
        primary_role: profile.primary_role,
        office: profile.office as { is_primary?: boolean | null } | null,
      });
      setDeliveries(data.deliveries);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load deliveries.");
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    void loadDeliveries();
  }, [loadDeliveries]);

  const filteredDeliveries = deliveries.filter((delivery) => {
    const matchesSearch = !searchTerm || 
      delivery.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      delivery.delivered_to.toLowerCase().includes(searchTerm.toLowerCase()) ||
      delivery.delivery_type.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || delivery.status === statusFilter;
    const matchesType = typeFilter === "all" || delivery.delivery_type === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  const stats = {
    total: deliveries.length,
    preparing: deliveries.filter(d => d.status === "preparing").length,
    delivered: deliveries.filter(d => d.status === "delivered").length,
    awaitingFeedback: deliveries.filter(d => d.status === "feedback_requested").length,
    approved: deliveries.filter(d => d.approval_received).length,
  };

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
              <h1 className="mt-2 text-3xl font-bold">Delivery Tracker</h1>
              <p className="mt-2 text-sm text-white/50">
                Track final media deliveries, manage client feedback, and monitor approval status.
              </p>
            </div>
            
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 rounded-2xl border border-white/10 bg-orange-500 px-4 py-3 text-sm font-semibold text-black hover:bg-orange-400"
            >
              <Plus size={16} />
              New Delivery
            </button>
          </div>

          {/* Stats Overview */}
          <div className="mb-6 grid gap-4 md:grid-cols-5">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-white/55">Total Deliveries</p>
                <Package className="text-orange-400" size={18} />
              </div>
              <p className="mt-3 text-2xl font-bold text-white">{stats.total}</p>
            </div>
            
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-white/55">Preparing</p>
                <CalendarDays className="text-blue-400" size={18} />
              </div>
              <p className="mt-3 text-2xl font-bold text-blue-300">{stats.preparing}</p>
            </div>
            
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-white/55">Delivered</p>
                <Truck className="text-emerald-400" size={18} />
              </div>
              <p className="mt-3 text-2xl font-bold text-emerald-300">{stats.delivered}</p>
            </div>
            
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-white/55">Awaiting Feedback</p>
                <CalendarDays className="text-amber-400" size={18} />
              </div>
              <p className="mt-3 text-2xl font-bold text-amber-300">{stats.awaitingFeedback}</p>
            </div>
            
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-white/55">Approved</p>
                <CheckCircle2 className="text-purple-400" size={18} />
              </div>
              <p className="mt-3 text-2xl font-bold text-purple-300">{stats.approved}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="mb-6 flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="text"
                  placeholder="Search deliveries..."
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
              {DELIVERY_STATUSES.map((status) => (
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
              {DELIVERY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>

          {/* Content */}
          {loading ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/60">
              Loading deliveries...
            </div>
          ) : error ? (
            <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-red-200">
              {error}
            </div>
          ) : filteredDeliveries.length === 0 ? (
            <EmptyState>
              {searchTerm || statusFilter !== "all" || typeFilter !== "all"
                ? "No deliveries match your filters."
                : "No deliveries found. Create a new delivery to get started."}
            </EmptyState>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm text-white/50">
                <span>{filteredDeliveries.length} deliver{filteredDeliveries.length !== 1 ? "ies" : "y"}</span>
                <button
                  type="button"
                  onClick={() => void loadDeliveries()}
                  className="flex items-center gap-1 text-orange-400 hover:text-orange-300"
                >
                  <CalendarDays size={14} />
                  Refresh
                </button>
              </div>
              
              <div className="grid gap-4">
                {filteredDeliveries.map((delivery) => (
                  <DeliveryCard key={delivery.id} delivery={delivery} />
                ))}
              </div>
            </div>
          )}

          {showCreateModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
              <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-black p-6">
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-xl font-bold">Record New Delivery</h2>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="rounded-lg p-2 text-white/60 hover:bg-white/10"
                  >
                    <X size={20} />
                  </button>
                </div>
                
                <div className="text-center text-sm text-white/50">
                  Delivery creation form would be implemented here with fields for:
                  title, delivery type, format, recipient, delivery date, and file attachments.
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
                    Create Delivery
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
