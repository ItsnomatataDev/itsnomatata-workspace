import { Eye, Edit3, RotateCcw, Trash2, Wrench, Archive } from "lucide-react";

type AssetStatus =
  | "in_stock"
  | "assigned"
  | "in_repair"
  | "retired"
  | "lost"
  | "disposed";

interface AssetRow {
  id: string;
  asset_name: string;
  asset_tag: string;
  serial_number: string;
  brand?: string | null;
  model?: string | null;
  asset_image_url?: string | null;
  status: AssetStatus;
  condition?: string | null;
  purchase_date?: string | null;
  assigned_profile?: {
    id: string;
    full_name?: string | null;
    email?: string | null;
  } | null;
  category?: {
    id: string;
    name: string;
  } | null;
  location?: {
    id: string;
    name: string;
    code?: string | null;
  } | null;
}

function getStatusClasses(status: AssetStatus) {
  switch (status) {
    case "in_stock":
      return "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20";
    case "assigned":
      return "bg-orange-500/10 text-orange-300 border border-orange-500/20";
    case "in_repair":
      return "bg-yellow-500/10 text-yellow-300 border border-yellow-500/20";
    case "retired":
      return "bg-zinc-500/10 text-zinc-300 border border-zinc-500/20";
    case "lost":
      return "bg-red-500/10 text-red-300 border border-red-500/20";
    case "disposed":
      return "bg-slate-500/10 text-slate-300 border border-slate-500/20";
    default:
      return "bg-white/10 text-white border border-white/10";
  }
}

function formatStatusLabel(status: AssetStatus) {
  return status.replace(/_/g, " ");
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
}

export default function AssetTable({
  assets,
  loading,
  canManage,
  onView,
  onEdit,
  onAssign,
  onReturn,
  onRepair,
  onRetire,
  onDelete,
}: {
  assets: AssetRow[];
  loading: boolean;
  canManage: boolean;
  onView: (asset: AssetRow) => void;
  onEdit: (asset: AssetRow) => void;
  onAssign: (asset: AssetRow) => void;
  onReturn: (asset: AssetRow) => void;
  onRepair: (asset: AssetRow) => void;
  onRetire: (asset: AssetRow) => void;
  onDelete: (asset: AssetRow) => void;
}) {
  if (loading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-neutral-950 p-6 text-sm text-white/60 shadow-lg shadow-black/20">
        Loading assets...
      </div>
    );
  }

  if (!assets.length) {
    return (
      <div className="rounded-3xl border border-white/10 bg-neutral-950 p-8 text-center text-sm text-white/50 shadow-lg shadow-black/20">
        No assets found.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-neutral-950 shadow-2xl shadow-black/30">
      <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm text-white">
        <thead className="border-b border-white/10 bg-white/5">
          <tr>
            <th className="px-4 py-3 font-medium text-white/65">Asset</th>
            <th className="px-4 py-3 font-medium text-white/65">Tag</th>
            <th className="px-4 py-3 font-medium text-white/65">Serial</th>
            <th className="px-4 py-3 font-medium text-white/65">Category</th>
            <th className="px-4 py-3 font-medium text-white/65">Location</th>
            <th className="px-4 py-3 font-medium text-white/65">Assigned To</th>
            <th className="px-4 py-3 font-medium text-white/65">
              Purchase Date
            </th>
            <th className="px-4 py-3 font-medium text-white/65">Status</th>
            <th className="px-4 py-3 font-medium text-white/65">Actions</th>
          </tr>
        </thead>

        <tbody>
          {assets.map((asset) => (
            <tr
              key={asset.id}
              className="border-b border-white/5 transition hover:bg-white/5"
            >
              <td className="px-4 py-4 align-top">
                <div className="flex items-start gap-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black">
                    {asset.asset_image_url ? (
                      <img
                        src={asset.asset_image_url}
                        alt={asset.asset_name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-zinc-500">
                        No image
                      </div>
                    )}
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={() => onView(asset)}
                      className="text-left font-medium text-white hover:text-orange-300"
                    >
                      {asset.asset_name}
                    </button>
                    <div className="mt-1 text-xs text-white/45">
                      {[asset.brand, asset.model].filter(Boolean).join(" • ") ||
                        "—"}
                    </div>
                  </div>
                </div>
              </td>

              <td className="px-4 py-4 align-top text-white/75">
                {asset.asset_tag}
              </td>
              <td className="px-4 py-4 align-top text-white/75">
                {asset.serial_number}
              </td>
              <td className="px-4 py-4 align-top text-white/75">
                {asset.category?.name ?? "—"}
              </td>
              <td className="px-4 py-4 align-top text-white/75">
                {asset.location?.name ?? "—"}
              </td>
              <td className="px-4 py-4 align-top text-white/75">
                {asset.assigned_profile?.full_name ||
                  asset.assigned_profile?.email ||
                  "—"}
              </td>
              <td className="px-4 py-4 align-top text-white/75">
                {formatDate(asset.purchase_date)}
              </td>
              <td className="px-4 py-4 align-top">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ${getStatusClasses(
                    asset.status,
                  )}`}
                >
                  {formatStatusLabel(asset.status)}
                </span>
              </td>

              <td className="px-4 py-4 align-top">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onView(asset)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs text-blue-300 transition hover:bg-blue-500/20"
                  >
                    <Eye size={14} />
                    View
                  </button>

                  {canManage ? (
                    <button
                      type="button"
                      onClick={() => onEdit(asset)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/75 transition hover:border-orange-500 hover:text-orange-300"
                    >
                      <Edit3 size={14} />
                      Edit
                    </button>
                  ) : null}

                  {canManage ? (
                    asset.status !== "assigned" ? (
                      <button
                        type="button"
                        onClick={() => onAssign(asset)}
                        className="inline-flex items-center gap-2 rounded-2xl border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-xs text-orange-300 transition hover:bg-orange-500/20"
                      >
                        <RotateCcw size={14} />
                        Assign
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onReturn(asset)}
                        className="inline-flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300 transition hover:bg-emerald-500/20"
                      >
                        <RotateCcw size={14} />
                        Return
                      </button>
                    )
                  ) : null}

                  {canManage ? (
                    <button
                      type="button"
                      onClick={() => onRepair(asset)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300 transition hover:bg-yellow-500/20"
                    >
                      <Wrench size={14} />
                      Repair
                    </button>
                  ) : null}

                  {canManage ? (
                    <button
                      type="button"
                      onClick={() => onRetire(asset)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/65 transition hover:bg-white/10 hover:text-white"
                    >
                      <Archive size={14} />
                      Retire
                    </button>
                  ) : null}

                  {canManage ? (
                    <button
                      type="button"
                      onClick={() => onDelete(asset)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300 transition hover:bg-red-500/20"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
