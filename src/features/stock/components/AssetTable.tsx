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
      <div className="border border-white/10 bg-black p-4 text-sm text-zinc-300">
        Loading assets...
      </div>
    );
  }

  if (!assets.length) {
    return (
      <div className="border border-white/10 bg-black p-6 text-center text-sm text-zinc-400">
        No assets found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-white/10 bg-black">
      <table className="min-w-full text-left text-sm text-white">
        <thead className="border-b border-white/10 bg-white/5">
          <tr>
            <th className="px-4 py-3 font-medium text-zinc-300">Asset</th>
            <th className="px-4 py-3 font-medium text-zinc-300">Tag</th>
            <th className="px-4 py-3 font-medium text-zinc-300">Serial</th>
            <th className="px-4 py-3 font-medium text-zinc-300">Category</th>
            <th className="px-4 py-3 font-medium text-zinc-300">Location</th>
            <th className="px-4 py-3 font-medium text-zinc-300">Assigned To</th>
            <th className="px-4 py-3 font-medium text-zinc-300">
              Purchase Date
            </th>
            <th className="px-4 py-3 font-medium text-zinc-300">Status</th>
            <th className="px-4 py-3 font-medium text-zinc-300">Actions</th>
          </tr>
        </thead>

        <tbody>
          {assets.map((asset) => (
            <tr
              key={asset.id}
              className="border-b border-white/5 hover:bg-white/5"
            >
              <td className="px-4 py-4 align-top">
                <div className="flex items-start gap-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden border border-white/10 bg-zinc-950">
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
                    <div className="mt-1 text-xs text-zinc-400">
                      {[asset.brand, asset.model].filter(Boolean).join(" • ") ||
                        "—"}
                    </div>
                  </div>
                </div>
              </td>

              <td className="px-4 py-4 align-top text-zinc-200">
                {asset.asset_tag}
              </td>
              <td className="px-4 py-4 align-top text-zinc-200">
                {asset.serial_number}
              </td>
              <td className="px-4 py-4 align-top text-zinc-200">
                {asset.category?.name ?? "—"}
              </td>
              <td className="px-4 py-4 align-top text-zinc-200">
                {asset.location?.name ?? "—"}
              </td>
              <td className="px-4 py-4 align-top text-zinc-200">
                {asset.assigned_profile?.full_name ||
                  asset.assigned_profile?.email ||
                  "—"}
              </td>
              <td className="px-4 py-4 align-top text-zinc-200">
                {formatDate(asset.purchase_date)}
              </td>
              <td className="px-4 py-4 align-top">
                <span
                  className={`inline-flex px-2 py-1 text-xs font-medium capitalize ${getStatusClasses(
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
                    className="inline-flex items-center gap-2 border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs text-blue-300 hover:bg-blue-500/20"
                  >
                    <Eye size={14} />
                    View
                  </button>

                  <button
                    type="button"
                    onClick={() => onEdit(asset)}
                    className="inline-flex items-center gap-2 border border-white/10 px-3 py-2 text-xs text-zinc-200 hover:border-orange-500 hover:text-orange-300"
                  >
                    <Edit3 size={14} />
                    Edit
                  </button>

                  {asset.status !== "assigned" ? (
                    <button
                      type="button"
                      onClick={() => onAssign(asset)}
                      className="inline-flex items-center gap-2 border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-xs text-orange-300 hover:bg-orange-500/20"
                    >
                      <RotateCcw size={14} />
                      Assign
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onReturn(asset)}
                      className="inline-flex items-center gap-2 border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300 hover:bg-emerald-500/20"
                    >
                      <RotateCcw size={14} />
                      Return
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onRepair(asset)}
                    className="inline-flex items-center gap-2 border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300 hover:bg-yellow-500/20"
                  >
                    <Wrench size={14} />
                    Repair
                  </button>

                  <button
                    type="button"
                    onClick={() => onRetire(asset)}
                    className="inline-flex items-center gap-2 border border-zinc-500/30 bg-zinc-500/10 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-500/20"
                  >
                    <Archive size={14} />
                    Retire
                  </button>

                  <button
                    type="button"
                    onClick={() => onDelete(asset)}
                    className="inline-flex items-center gap-2 border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300 hover:bg-red-500/20"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
