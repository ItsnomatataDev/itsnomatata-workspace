import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Plus,
  Boxes,
  PackageCheck,
  Wrench,
  Archive,
  ArrowRight,
  Bot,
  ClipboardList,
  Download,
  FileText,
  Loader2,
  MessageSquareText,
  ScanLine,
  ShieldAlert,
  Upload,
} from "lucide-react";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import { useAuth } from "../../../app/providers/AuthProvider";
import { useAssets } from "../../../lib/hooks/useAssets";
import { askAssistant, buildAssistantContext } from "../../../lib/api/ai";
import { supabase } from "../../../lib/supabase/client";
import AssetTable from "../components/AssetTable";
import AssetForm from "../components/AssetForm";
import AssetImportModal from "../components/AssetImportModal";
import TotalCostCard from "../components/TotalCostCard";
import ProductionAssetSearch from "../components/ProductionAssetSearch";
import { fetchActiveAssetAssignment } from "../services/stockService";
import { exportAssetsToExcel } from "../services/assetExportService";
import type { CreateAssetInput } from "../../../lib/supabase/mutations/assets";

interface LookupOption {
  id: string;
  name: string;
  code?: string | null;
  image_url?: string | null;
}

interface PurchaseBatchOption {
  id: string;
  label: string;
}

interface ProfileOption {
  id: string;
  full_name?: string | null;
  email?: string | null;
}

interface ActiveAssignment {
  id: string;
  asset_id: string;
  assigned_to?: string | null;
  assigned_project_id?: string | null;
  assigned_location_id?: string | null;
  assigned_by?: string | null;
  assigned_at?: string | null;
  due_back_at?: string | null;
  returned_at?: string | null;
  returned_by?: string | null;
  status?: string | null;
  notes?: string | null;
  assigned_to_profile?: {
    id: string;
    full_name?: string | null;
    email?: string | null;
  } | null;
  assigned_by_profile?: {
    id: string;
    full_name?: string | null;
    email?: string | null;
  } | null;
}

interface AssetRecord {
  id: string;
  asset_name: string;
  asset_tag: string;
  serial_number: string;
  purchase_batch_id?: string | null;
  category_id?: string | null;
  current_location_id?: string | null;
  brand?: string | null;
  model?: string | null;
  description?: string | null;
  purchase_price?: number | null;
  currency?: string | null;
  purchase_date?: string | null;
  warranty_expiry_date?: string | null;
  expected_life_months?: number | null;
  invoice_number?: string | null;
  reference_number?: string | null;
  insured?: boolean | null;
  insurance_provider?: string | null;
  insurance_policy_number?: string | null;
  insurance_expiry_date?: string | null;
  sub_location?: string | null;
  barcode_value?: string | null;
  qr_code_value?: string | null;
  asset_image_url?: string | null;
  site_image_url?: string | null;
  notes?: string | null;
  status:
    | "in_stock"
    | "assigned"
    | "in_repair"
    | "retired"
    | "lost"
    | "disposed";
  condition?: string | null;
  assigned_profile?: {
    id: string;
    full_name?: string | null;
    email?: string | null;
  } | null;
  created_profile?: {
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
    image_url?: string | null;
  } | null;
}

function StatBox({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="border border-white/10 bg-black p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-400">{title}</p>
          <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
        </div>
        <div className="border border-orange-500/20 bg-orange-500/10 p-3 text-orange-300">
          {icon}
        </div>
      </div>
    </div>
  );
}

function isDateWithinDays(value?: string | null, days = 30) {
  if (!value) return false;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const now = Date.now();
  const diff = date.getTime() - now;
  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
}

function assetNeedsAttention(asset: AssetRecord) {
  return (
    asset.status === "in_repair" ||
    asset.status === "lost" ||
    asset.insured !== true ||
    !asset.location?.name ||
    isDateWithinDays(asset.warranty_expiry_date, 45)
  );
}

function buildTimeSavingIdeas(params: {
  stats: {
    total: number;
    in_stock: number;
    assigned: number;
    in_repair: number;
    retired: number;
    lost: number;
    disposed: number;
    insured: number;
    uninsured: number;
  };
  assets: AssetRecord[];
}) {
  const warrantyExpiringSoon = params.assets.filter((asset) =>
    isDateWithinDays(asset.warranty_expiry_date, 45),
  ).length;
  const missingLocation = params.assets.filter(
    (asset) => !asset.location?.name && !asset.sub_location,
  ).length;

  const ideas = [
    params.stats.in_stock > 0
      ? {
          title: "Reuse idle equipment first",
          description: `${params.stats.in_stock} asset(s) are currently in stock. Reassigning these before buying new hardware cuts procurement time and cost.`,
        }
      : null,
    params.stats.in_repair > 0
      ? {
          title: "Reduce repair downtime",
          description: `${params.stats.in_repair} asset(s) are in repair. A weekly repair follow-up list will keep teams productive and reduce replacement requests.`,
        }
      : null,
    params.stats.uninsured > 0
      ? {
          title: "Protect high-value items",
          description: `${params.stats.uninsured} asset(s) are uninsured. Prioritizing cover for key devices lowers replacement risk and admin delays.`,
        }
      : null,
    warrantyExpiringSoon > 0
      ? {
          title: "Catch warranty deadlines early",
          description: `${warrantyExpiringSoon} asset(s) have warranties expiring soon. Servicing or renewing them early avoids avoidable support costs.`,
        }
      : null,
    missingLocation > 0
      ? {
          title: "Fix tracking gaps",
          description: `${missingLocation} asset(s) have incomplete location details. Cleaning this up saves staff time when searching or auditing equipment.`,
        }
      : null,
  ].filter(Boolean) as Array<{ title: string; description: string }>;

  if (ideas.length > 0) {
    return ideas.slice(0, 4);
  }

  return [
    {
      title: "Asset operations look healthy",
      description:
        "Inventory data is in a good state. Use the AI helper to draft audits, summaries, and assignment follow-ups faster.",
    },
  ];
}

function formatAssetLine(asset: AssetRecord) {
  return `${asset.asset_name} (${asset.asset_tag || "No tag"}) • ${asset.status.replaceAll("_", " ")}`;
}

function buildWeeklyAssetReport(params: {
  stats: {
    total: number;
    in_stock: number;
    assigned: number;
    in_repair: number;
    retired: number;
    lost: number;
    disposed: number;
    insured: number;
    uninsured: number;
  };
  assets: AssetRecord[];
  attentionCount: number;
}) {
  const repairAssets = params.assets.filter(
    (asset) => asset.status === "in_repair",
  );
  const expiringAssets = params.assets.filter((asset) =>
    isDateWithinDays(asset.warranty_expiry_date, 45),
  );

  const lines = [
    `AssetTiger Weekly Report — ${new Date().toLocaleDateString()}`,
    "",
    "Inventory Snapshot",
    `• Total assets: ${params.stats.total}`,
    `• Available in stock: ${params.stats.in_stock}`,
    `• Assigned to staff/projects: ${params.stats.assigned}`,
    `• In repair: ${params.stats.in_repair}`,
    `• Uninsured: ${params.stats.uninsured}`,
    `• Needs attention: ${params.attentionCount}`,
    "",
    "Priority Actions",
    params.stats.in_stock > 0
      ? `• Reuse ${params.stats.in_stock} available asset(s) before raising new purchase requests.`
      : "• No idle stock detected right now.",
    repairAssets.length > 0
      ? `• Follow up on repair items: ${repairAssets.slice(0, 3).map(formatAssetLine).join("; ")}`
      : "• No assets are currently stuck in repair.",
    expiringAssets.length > 0
      ? `• Review expiring warranties for: ${expiringAssets.slice(0, 3).map(formatAssetLine).join("; ")}`
      : "• No immediate warranty expiries found.",
    params.stats.uninsured > 0
      ? `• Prioritize insurance cover for ${params.stats.uninsured} asset(s) to reduce admin risk.`
      : "• Insurance coverage looks healthy.",
    "",
    "Suggested Weekly Routine",
    "1. Export the needs-attention list and review it in the Monday ops meeting.",
    "2. Reassign available devices before approving new procurement.",
    "3. Chase repair vendors and close overdue maintenance items.",
    "4. Verify missing locations and barcode scans before the week ends.",
  ];

  return lines.join("\n");
}

function buildRepairFollowUpMessage(repairAssets: AssetRecord[]) {
  if (!repairAssets.length) {
    return [
      "Repair Follow-up Draft",
      "",
      "No assets are currently marked as in repair, so no vendor follow-up is needed right now.",
    ].join("\n");
  }

  return [
    "Repair Follow-up Draft",
    "",
    "Hello team,",
    "",
    "Please share an update on the following assets currently marked as in repair:",
    ...repairAssets.slice(0, 8).map((asset) => `• ${formatAssetLine(asset)}`),
    "",
    "Kindly confirm expected completion dates, blockers, and whether any temporary replacements are needed.",
    "",
    "Thanks.",
  ].join("\n");
}

function buildLocalAssetOutput(params: {
  mode: "summary" | "audit" | "savings" | "weekly_report" | "repair_followup";
  stats: {
    total: number;
    in_stock: number;
    assigned: number;
    in_repair: number;
    retired: number;
    lost: number;
    disposed: number;
    insured: number;
    uninsured: number;
  };
  assets: AssetRecord[];
  attentionCount: number;
  timeSavingIdeas: Array<{ title: string; description: string }>;
}) {
  switch (params.mode) {
    case "weekly_report":
      return buildWeeklyAssetReport({
        stats: params.stats,
        assets: params.assets,
        attentionCount: params.attentionCount,
      });
    case "repair_followup":
      return buildRepairFollowUpMessage(
        params.assets.filter((asset) => asset.status === "in_repair"),
      );
    case "audit":
      return [
        "Weekly Asset Audit Checklist",
        "",
        "• Verify all assets in the 'needs attention' filter.",
        "• Confirm physical location and barcode scan for shared devices.",
        "• Review assets still marked 'in repair' and record next action.",
        "• Check uninsured items and expiring warranties.",
        "• Reconcile any devices still assigned to inactive or moved staff.",
      ].join("\n");
    case "savings":
      return [
        "Cost-saving opportunities",
        "",
        ...params.timeSavingIdeas.map((item) => `• ${item.description}`),
      ].join("\n");
    case "summary":
    default:
      return [
        "Local time-saving opportunities:",
        ...params.timeSavingIdeas.map((item) => `• ${item.description}`),
      ].join("\n");
  }
}

function AssignAssetModal({
  open,
  asset,
  users,
  saving,
  onClose,
  onAssign,
}: {
  open: boolean;
  asset: AssetRecord | null;
  users: ProfileOption[];
  saving: boolean;
  onClose: () => void;
  onAssign: (userId: string) => Promise<void>;
}) {
  const [selectedUserId, setSelectedUserId] = useState("");

  useEffect(() => {
    if (!open) return;
    setSelectedUserId("");
  }, [open]);

  if (!open || !asset) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 px-4 py-8">
      <div className="w-full max-w-lg border border-white/10 bg-black p-6">
        <div className="mb-5">
          <h2 className="text-xl font-semibold text-white">Assign Asset</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Assign <span className="text-white">{asset.asset_name}</span> to a
            registered user.
          </p>
        </div>

        <div className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm text-zinc-300">Select User</span>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
            >
              <option value="">Choose a registered user</option>
              {users.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.full_name || item.email || item.id}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={!selectedUserId || saving}
            onClick={() => void onAssign(selectedUserId)}
            className="border border-orange-500 bg-orange-500 px-5 py-3 text-sm font-medium text-black hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Assigning..." : "Assign Asset"}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="border border-white/10 px-5 py-3 text-sm text-zinc-200 hover:border-white/20 hover:text-white"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function ReturnAssetModal({
  open,
  asset,
  assignment,
  saving,
  onClose,
  onReturn,
}: {
  open: boolean;
  asset: AssetRecord | null;
  assignment: ActiveAssignment | null;
  saving: boolean;
  onClose: () => void;
  onReturn: () => Promise<void>;
}) {
  if (!open || !asset) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 px-4 py-8">
      <div className="w-full max-w-lg border border-white/10 bg-black p-6">
        <div className="mb-5">
          <h2 className="text-xl font-semibold text-white">Return Asset</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Return <span className="text-white">{asset.asset_name}</span> from
            the current assignee.
          </p>
        </div>

        <div className="space-y-3 border border-white/10 p-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Assigned To
            </p>
            <p className="mt-1 text-sm text-white">
              {assignment?.assigned_to_profile?.full_name ||
                assignment?.assigned_to_profile?.email ||
                "No active assignee found"}
            </p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Assigned At
            </p>
            <p className="mt-1 text-sm text-white">
              {assignment?.assigned_at
                ? new Date(assignment.assigned_at).toLocaleString()
                : "—"}
            </p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Notes
            </p>
            <p className="mt-1 text-sm text-white">
              {assignment?.notes || "—"}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={!assignment?.id || saving}
            onClick={() => void onReturn()}
            className="border border-emerald-500 bg-emerald-500 px-5 py-3 text-sm font-medium text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Returning..." : "Return Asset"}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="border border-white/10 px-5 py-3 text-sm text-zinc-200 hover:border-white/20 hover:text-white"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AssetsPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const user = auth?.user ?? null;
  const profile = auth?.profile ?? null;
  const organizationId = profile?.organization_id;

  const {
    assets,
    stats,
    loading,
    saving,
    error,
    reload,
    search,
    addAsset,
    updateAsset,
    assignAsset,
    returnAsset,
    markInRepair,
    retireAsset,
    deleteAsset,
  } = useAssets(organizationId ?? null);

  const [searchTerm, setSearchTerm] = useState("");
  const [categories, setCategories] = useState<LookupOption[]>([]);
  const [locations, setLocations] = useState<LookupOption[]>([]);
  const [purchaseBatches, setPurchaseBatches] = useState<PurchaseBatchOption[]>(
    [],
  );
  const [users, setUsers] = useState<ProfileOption[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selectedAsset, setSelectedAsset] = useState<AssetRecord | null>(null);

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importingAssets, setImportingAssets] = useState(false);

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assigningAsset, setAssigningAsset] = useState<AssetRecord | null>(
    null,
  );

  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returningAsset, setReturningAsset] = useState<AssetRecord | null>(
    null,
  );
  const [activeAssignment, setActiveAssignment] =
    useState<ActiveAssignment | null>(null);
  const [assetAIAdvice, setAssetAIAdvice] = useState("");
  const [assetAIHeading, setAssetAIHeading] = useState("Asset helper output");
  const [assetAIError, setAssetAIError] = useState("");
  const [assetAIloading, setAssetAILoading] = useState(false);
  const [viewFilter, setViewFilter] = useState<
    "all" | "available" | "assigned" | "repair" | "attention"
  >("all");

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  async function loadLookups() {
    if (!organizationId) return;

    const [categoriesResult, locationsResult, batchesResult, usersResult] =
      await Promise.all([
        supabase
          .from("asset_categories")
          .select("id, name")
          .eq("organization_id", organizationId)
          .order("name", { ascending: true }),

        supabase
          .from("stock_locations")
          .select("id, name, code, image_url")
          .eq("organization_id", organizationId)
          .order("name", { ascending: true }),

        supabase
          .from("purchase_batches")
          .select("id, reference_number, invoice_number, purchase_date")
          .eq("organization_id", organizationId)
          .order("purchase_date", { ascending: false }),

        supabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("organization_id", organizationId)
          .order("full_name", { ascending: true }),
      ]);

    if (!categoriesResult.error) {
      setCategories(categoriesResult.data ?? []);
    }

    if (!locationsResult.error) {
      setLocations(locationsResult.data ?? []);
    }

    if (!batchesResult.error) {
      setPurchaseBatches(
        (batchesResult.data ?? []).map((item) => ({
          id: item.id,
          label:
            item.reference_number ||
            item.invoice_number ||
            `Batch ${item.purchase_date ?? item.id.slice(0, 8)}`,
        })),
      );
    }

    if (!usersResult.error) {
      setUsers(usersResult.data ?? []);
    }
  }

  useEffect(() => {
    void loadLookups();
  }, [organizationId]);

  const assetRows = useMemo(() => assets as AssetRecord[], [assets]);

  const timeSavingIdeas = useMemo(
    () => buildTimeSavingIdeas({ stats, assets: assetRows }),
    [assetRows, stats],
  );

  const attentionAssets = useMemo(
    () => assetRows.filter((asset) => assetNeedsAttention(asset)),
    [assetRows],
  );

  const attentionCount = useMemo(
    () => attentionAssets.length,
    [attentionAssets],
  );

  const displayedAssets = useMemo(() => {
    switch (viewFilter) {
      case "available":
        return assetRows.filter((asset) => asset.status === "in_stock");
      case "assigned":
        return assetRows.filter((asset) => asset.status === "assigned");
      case "repair":
        return assetRows.filter((asset) => asset.status === "in_repair");
      case "attention":
        return assetRows.filter((asset) => assetNeedsAttention(asset));
      default:
        return assetRows;
    }
  }, [assetRows, viewFilter]);

  async function createPurchaseBatch(label: string) {
    const trimmed = label.trim();

    if (!trimmed) {
      throw new Error("Purchase batch name is required.");
    }

    const existing = purchaseBatches.find(
      (batch) => batch.label.trim().toLowerCase() === trimmed.toLowerCase(),
    );

    if (existing) {
      return existing.id;
    }

    const { data, error } = await supabase
      .from("purchase_batches")
      .insert({
        organization_id: organizationId,
        reference_number: trimmed,
        invoice_number: trimmed,
        purchase_date: new Date().toISOString().slice(0, 10),
        created_by: user?.id ?? null,
      })
      .select("id, reference_number, invoice_number, purchase_date")
      .single();

    if (error) {
      throw new Error(error.message || "Failed to create purchase batch.");
    }

    const newLabel =
      data.reference_number ||
      data.invoice_number ||
      `Batch ${data.purchase_date ?? data.id.slice(0, 8)}`;

    setPurchaseBatches((current) => [
      { id: data.id, label: newLabel },
      ...current,
    ]);

    return data.id;
  }

  async function handleImportAssets(rows: CreateAssetInput[]) {
    setImportingAssets(true);

    try {
      const assetTags = rows
        .map((row) => row.asset_tag?.trim())
        .filter((tag): tag is string => Boolean(tag));

      if (assetTags.length > 0) {
        const { data: existingTags, error: existingTagsError } = await supabase
          .from("assets")
          .select("asset_tag")
          .eq("organization_id", organizationId)
          .in("asset_tag", assetTags);

        if (existingTagsError) {
          throw new Error(existingTagsError.message);
        }

        const existingSet = new Set(
          (existingTags ?? [])
            .map((item) => item.asset_tag?.trim().toLowerCase())
            .filter(Boolean),
        );

        const conflicting = assetTags.filter((tag) =>
          existingSet.has(tag.trim().toLowerCase()),
        );

        if (conflicting.length > 0) {
          throw new Error(
            `These asset tags already exist: ${conflicting.join(", ")}`,
          );
        }
      }

      for (const row of rows) {
        await addAsset(row);
      }

      await reload();
      await loadLookups();
      setImportModalOpen(false);
    } catch (err) {
      throw err instanceof Error ? err : new Error("Failed to import assets.");
    } finally {
      setImportingAssets(false);
    }
  }

  async function handleRunAssetAssistant(
    mode: "summary" | "audit" | "savings" | "weekly_report" | "repair_followup",
  ) {
    const aiContext = buildAssistantContext({
      userId: user?.id ?? "stock-user",
      organizationId,
      fullName: profile?.full_name ?? user?.email ?? "Workspace User",
      email: user?.email ?? null,
      role: profile?.primary_role ?? "it",
      department:
        typeof profile?.department === "string" ? profile.department : null,
      currentRoute: "/assets",
      currentModule: "assettiger",
      channel: "web",
      timezone: "Africa/Harare",
    });

    const prompts = {
      summary:
        "Review the current AssetTiger inventory snapshot and explain the biggest time-saving opportunities for the company. Focus on idle assets, tracking gaps, repairs, and staff productivity.",
      audit:
        "Using the current asset inventory snapshot, draft a short weekly audit checklist that helps the company save time and reduce missing equipment issues.",
      savings:
        "Based on the current asset inventory data, give a concise cost-saving and time-saving action plan for management. Prioritize reuse, faster handovers, and repair turnaround.",
      weekly_report:
        "Create a concise weekly asset report for management using this AssetTiger inventory snapshot. Include counts, issues, priorities, and recommended next steps.",
      repair_followup:
        "Draft a short professional follow-up message for assets currently in repair, asking for updates and expected completion dates.",
    } as const;

    const labels = {
      summary: "Time-saving plan",
      audit: "Audit checklist",
      savings: "Cost-saving ideas",
      weekly_report: "Weekly asset report",
      repair_followup: "Repair follow-up draft",
    } as const;

    try {
      setAssetAIHeading(labels[mode]);
      setAssetAILoading(true);
      setAssetAIError("");

      const response = await askAssistant({
        message: prompts[mode],
        context: aiContext,
        metadata: {
          source: "assettiger_productivity_panel",
          requestedAction: mode,
          assetSummary: {
            total: stats.total,
            inStock: stats.in_stock,
            assigned: stats.assigned,
            inRepair: stats.in_repair,
            uninsured: stats.uninsured,
            attentionCount,
            currentViewCount: displayedAssets.length,
          },
          sampleAssets: assetRows.slice(0, 12).map((asset) => ({
            asset_name: asset.asset_name,
            asset_tag: asset.asset_tag,
            status: asset.status,
            assigned_to:
              asset.assigned_profile?.full_name ||
              asset.assigned_profile?.email ||
              null,
            location: asset.location?.name || asset.sub_location || null,
            insured: asset.insured ?? false,
            warranty_expiry_date: asset.warranty_expiry_date ?? null,
          })),
        },
      });

      setAssetAIAdvice(response.message || "No response returned yet.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to generate asset advice.";
      setAssetAIError(message);
      setAssetAIAdvice(
        buildLocalAssetOutput({
          mode,
          stats,
          assets: assetRows,
          attentionCount,
          timeSavingIdeas,
        }),
      );
    } finally {
      setAssetAILoading(false);
    }
  }

  async function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await search(searchTerm);
  }

  function handleAddClick() {
    setSelectedAsset(null);
    setFormMode("create");
    setFormOpen(true);
  }

  function handleEditClick(asset: AssetRecord) {
    setSelectedAsset(asset);
    setFormMode("edit");
    setFormOpen(true);
  }

  function handleViewClick(asset: AssetRecord) {
    navigate(`/assets/${asset.id}`);
  }

  function handleAssignClick(asset: AssetRecord) {
    setAssigningAsset(asset);
    setAssignModalOpen(true);
  }

  async function submitAssign(userId: string) {
    if (!organizationId || !user?.id || !assigningAsset) return;

    await assignAsset({
      organization_id: organizationId,
      asset_id: assigningAsset.id,
      assigned_to: userId,
      assigned_by: user.id,
      assigned_location_id: assigningAsset.current_location_id ?? null,
      notes: "Assigned from assets page",
    });

    setAssignModalOpen(false);
    setAssigningAsset(null);
  }

  async function handleReturnClick(asset: AssetRecord) {
    setReturningAsset(asset);
    setReturnModalOpen(true);

    try {
      const assignment = await fetchActiveAssetAssignment(asset.id);
      setActiveAssignment((assignment as ActiveAssignment | null) ?? null);
    } catch {
      setActiveAssignment(null);
    }
  }

  async function submitReturn() {
    if (!user?.id || !returningAsset || !activeAssignment?.id) return;

    await returnAsset({
      assignment_id: activeAssignment.id,
      asset_id: returningAsset.id,
      returned_by: user.id,
      location_id: returningAsset.current_location_id ?? null,
    });

    setReturnModalOpen(false);
    setReturningAsset(null);
    setActiveAssignment(null);
  }

  async function handleRepairClick(asset: AssetRecord) {
    const confirmed = window.confirm(
      `Mark "${asset.asset_name}" as in repair?`,
    );
    if (!confirmed) return;
    await markInRepair(asset.id);
  }

  async function handleRetireClick(asset: AssetRecord) {
    const confirmed = window.confirm(`Retire "${asset.asset_name}"?`);
    if (!confirmed) return;
    await retireAsset(asset.id);
  }

  async function handleDeleteClick(asset: AssetRecord) {
    const confirmed = window.confirm(
      `Delete "${asset.asset_name}" permanently? This cannot be undone.`,
    );
    if (!confirmed) return;
    await deleteAsset(asset.id);
  }

  if (!user || !profile) return null;
  if (!organizationId) return null;

  return (
    <div className="min-h-screen bg-black text-white lg:flex">
      <Sidebar role={profile.primary_role} />

      <main className="flex-1 px-4 pt-4 pb-6 md:px-6">
        <div className="space-y-6">
          <section className="border border-white/10 bg-black p-4">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm uppercase tracking-wide text-orange-300">
                  Stock & Assets
                </p>
                <h1 className="mt-2 text-3xl font-semibold text-white">
                  Serialized Assets
                </h1>
                <p className="mt-3 max-w-3xl text-sm text-zinc-400">
                  Track asset tags, serial numbers, pricing, insurance, photos,
                  location/site details, and assignment status for physical
                  company equipment.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void reload()}
                  className="border border-white/10 px-4 py-3 text-sm text-zinc-200 hover:border-white/20 hover:text-white"
                >
                  Refresh
                </button>

                <button
                  type="button"
                  onClick={() => exportAssetsToExcel(assetRows)}
                  className="border border-white/10 px-4 py-3 text-sm text-zinc-200 hover:border-white/20 hover:text-white"
                >
                  Export All Assets
                </button>

                <button
                  type="button"
                  onClick={() => setImportModalOpen(true)}
                  className="inline-flex items-center gap-2 border border-white/10 px-4 py-3 text-sm text-zinc-200 hover:border-white/20 hover:text-white"
                >
                  <Upload size={16} />
                  Import Assets
                </button>

                <button
                  type="button"
                  onClick={handleAddClick}
                  className="inline-flex items-center gap-2 border border-orange-500 bg-orange-500 px-4 py-3 text-sm font-medium text-black hover:bg-orange-400"
                >
                  <Plus size={16} />
                  Add Asset
                </button>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <TotalCostCard organizationId={organizationId} />
            <StatBox
              title="Total Assets"
              value={stats.total}
              icon={<Boxes size={20} />}
            />
            <StatBox
              title="In Stock"
              value={stats.in_stock}
              icon={<PackageCheck size={20} />}
            />
            <StatBox
              title="In Repair"
              value={stats.in_repair}
              icon={<Wrench size={20} />}
            />
            <StatBox
              title="Retired"
              value={stats.retired}
              icon={<Archive size={20} />}
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="border border-white/10 bg-black p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-orange-300">
                    AssetTiger productivity helper
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-white">
                    Save time with smarter asset actions
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm text-zinc-400">
                    Use live Supabase asset data to spot idle equipment, reduce
                    repair delays, prepare audits faster, and avoid unnecessary
                    purchases.
                  </p>
                </div>

                <div className="border border-orange-500/20 bg-orange-500/10 p-3 text-orange-300">
                  <Bot size={20} />
                </div>
              </div>

              {assetAIError ? (
                <div className="mt-4 border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                  {assetAIError}
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleRunAssetAssistant("weekly_report")}
                  disabled={assetAIloading}
                  className="inline-flex items-center gap-2 border border-orange-500 bg-orange-500 px-4 py-2.5 text-sm font-medium text-black hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {assetAIloading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <FileText size={16} />
                  )}
                  Generate weekly report
                </button>

                <button
                  type="button"
                  onClick={() => void handleRunAssetAssistant("summary")}
                  disabled={assetAIloading}
                  className="inline-flex items-center gap-2 border border-white/10 px-4 py-2.5 text-sm text-zinc-200 hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ArrowRight size={16} />
                  Time-saving plan
                </button>

                <button
                  type="button"
                  onClick={() => void handleRunAssetAssistant("audit")}
                  disabled={assetAIloading}
                  className="inline-flex items-center gap-2 border border-white/10 px-4 py-2.5 text-sm text-zinc-200 hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ClipboardList size={16} />
                  Audit checklist
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void handleRunAssetAssistant("repair_followup")
                  }
                  disabled={assetAIloading}
                  className="inline-flex items-center gap-2 border border-white/10 px-4 py-2.5 text-sm text-zinc-200 hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <MessageSquareText size={16} />
                  Repair follow-up
                </button>

                <button
                  type="button"
                  onClick={() => void handleRunAssetAssistant("savings")}
                  disabled={assetAIloading}
                  className="inline-flex items-center gap-2 border border-white/10 px-4 py-2.5 text-sm text-zinc-200 hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Bot size={16} />
                  Cost-saving ideas
                </button>

                <button
                  type="button"
                  onClick={() => exportAssetsToExcel(attentionAssets)}
                  disabled={attentionAssets.length === 0}
                  className="inline-flex items-center gap-2 border border-white/10 px-4 py-2.5 text-sm text-zinc-200 hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Download size={16} />
                  Export needs attention
                </button>

                <button
                  type="button"
                  onClick={() => exportAssetsToExcel(displayedAssets)}
                  disabled={displayedAssets.length === 0}
                  className="inline-flex items-center gap-2 border border-white/10 px-4 py-2.5 text-sm text-zinc-200 hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Download size={16} />
                  Export current view
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/scan")}
                  className="inline-flex items-center gap-2 border border-white/10 px-4 py-2.5 text-sm text-zinc-200 hover:border-white/20 hover:text-white"
                >
                  <ScanLine size={16} />
                  Open scanner
                </button>
              </div>

              <div className="mt-4 border border-white/10 bg-zinc-950 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                  {assetAIHeading}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white">
                  {assetAIAdvice ||
                    "Use the buttons above to generate a weekly report, audit checklist, repair follow-up draft, cost-saving plan, or export the exact asset view your team needs."}
                </p>
              </div>
            </div>

            <div className="border border-white/10 bg-black p-5">
              <div className="flex items-center gap-2 text-orange-300">
                <ShieldAlert size={18} />
                <h3 className="text-base font-semibold">
                  Where this saves time
                </h3>
              </div>

              <div className="mt-4 space-y-3">
                {timeSavingIdeas.map((item) => (
                  <div
                    key={item.title}
                    className="border border-white/10 bg-zinc-950 p-3"
                  >
                    <p className="text-sm font-medium text-white">
                      {item.title}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-zinc-400">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="border border-white/10 bg-black p-5">
            <ProductionAssetSearch
              onSearch={(query: string) => {
                // Production search implementation
                if (search && typeof search === 'function') {
                  search(query);
                }
              }}
              placeholder="Search assets by name, tag, or serial number..."
              className="w-full"
            />

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {[
                { id: "all", label: `All (${assetRows.length})` },
                { id: "available", label: `Available (${stats.in_stock})` },
                { id: "assigned", label: `Assigned (${stats.assigned})` },
                { id: "repair", label: `In Repair (${stats.in_repair})` },
                {
                  id: "attention",
                  label: `Needs Attention (${attentionCount})`,
                },
              ].map((filter) => {
                const active = viewFilter === filter.id;

                return (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() =>
                      setViewFilter(
                        filter.id as
                          | "all"
                          | "available"
                          | "assigned"
                          | "repair"
                          | "attention",
                      )
                    }
                    className={`px-3 py-2 text-sm transition ${
                      active
                        ? "border border-orange-500 bg-orange-500 text-black"
                        : "border border-white/10 bg-black text-zinc-200 hover:border-white/20 hover:text-white"
                    }`}
                  >
                    {filter.label}
                  </button>
                );
              })}

              <p className="ml-auto text-xs text-zinc-500">
                Showing {displayedAssets.length} of {assetRows.length} asset(s)
              </p>
            </div>
          </section>

          {error ? (
            <section className="border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </section>
          ) : null}

          <section>
            <AssetTable
              assets={displayedAssets}
              loading={loading}
              onView={handleViewClick}
              onEdit={handleEditClick}
              onAssign={(asset) => handleAssignClick(asset)}
              onReturn={(asset) => void handleReturnClick(asset)}
              onRepair={(asset) => void handleRepairClick(asset)}
              onRetire={(asset) => void handleRetireClick(asset)}
              onDelete={(asset) => void handleDeleteClick(asset)}
            />
          </section>
        </div>
      </main>

      <AssetForm
        mode={formMode}
        open={formOpen}
        saving={saving}
        asset={selectedAsset}
        categories={categories}
        locations={locations}
        purchaseBatches={purchaseBatches}
        organizationId={organizationId}
        userId={user.id}
        onClose={() => setFormOpen(false)}
        onCreate={async (input) => {
          await addAsset(input);
          await loadLookups();
        }}
        onUpdate={async (assetId, input) => {
          await updateAsset(assetId, input);
          await loadLookups();
        }}
        onCreatePurchaseBatch={createPurchaseBatch}
      />

      <AssetImportModal
        open={importModalOpen}
        organizationId={organizationId}
        userId={user.id}
        categories={categories}
        locations={locations}
        purchaseBatches={purchaseBatches}
        saving={importingAssets}
        onClose={() => setImportModalOpen(false)}
        onImport={handleImportAssets}
        onCreatePurchaseBatch={createPurchaseBatch}
      />

      <AssignAssetModal
        open={assignModalOpen}
        asset={assigningAsset}
        users={users}
        saving={saving}
        onClose={() => {
          setAssignModalOpen(false);
          setAssigningAsset(null);
        }}
        onAssign={submitAssign}
      />

      <ReturnAssetModal
        open={returnModalOpen}
        asset={returningAsset}
        assignment={activeAssignment}
        saving={saving}
        onClose={() => {
          setReturnModalOpen(false);
          setReturningAsset(null);
          setActiveAssignment(null);
        }}
        onReturn={submitReturn}
      />
    </div>
  );
}
