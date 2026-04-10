import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Plus,
  Boxes,
  PackageCheck,
  Wrench,
  Archive,
} from "lucide-react";
import Sidebar from "../../../components/dashboard/components/Siderbar";
import { useAuth } from "../../../app/providers/AuthProvider";
import { useAssets } from "../../../lib/hooks/useAssets";
import { supabase } from "../../../lib/supabase/client";
import AssetTable from "../components/AssetTable";
import AssetForm from "../components/AssetForm";
import { fetchActiveAssetAssignment } from "../services/stockService";
import { exportAssetsToExcel } from "../services/assetExportService";

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

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  useEffect(() => {
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

    void loadLookups();
  }, [organizationId]);

  const assetRows = useMemo(() => assets as AssetRecord[], [assets]);

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
                  onClick={handleAddClick}
                  className="inline-flex items-center gap-2 border border-orange-500 bg-orange-500 px-4 py-3 text-sm font-medium text-black hover:bg-orange-400"
                >
                  <Plus size={16} />
                  Add Asset
                </button>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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

          <section className="border border-white/10 bg-black p-5">
            <form
              onSubmit={handleSearchSubmit}
              className="flex flex-col gap-3 lg:flex-row"
            >
              <div className="relative flex-1">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"
                />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by asset name, asset tag, serial number, brand, model, invoice, or reference"
                  className="w-full border border-white/10 bg-black py-3 pl-11 pr-4 text-sm text-white outline-none focus:border-orange-500"
                />
              </div>

              <button
                type="submit"
                className="border border-orange-500 bg-orange-500 px-5 py-3 text-sm font-medium text-black hover:bg-orange-400"
              >
                Search
              </button>
            </form>
          </section>

          {error ? (
            <section className="border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </section>
          ) : null}

          <section>
            <AssetTable
              assets={assetRows}
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
        }}
        onUpdate={async (assetId, input) => {
          await updateAsset(assetId, input);
        }}
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
