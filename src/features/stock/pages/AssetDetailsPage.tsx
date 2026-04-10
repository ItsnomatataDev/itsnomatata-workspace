import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  ArrowLeft,
  Printer,
  Package,
  MapPin,
  Receipt,
  Shield,
  User,
  CalendarDays,
} from "lucide-react";
import Sidebar from "../../../components/dashboard/components/Siderbar";
import { useAuth } from "../../../app/providers/AuthProvider";
import { fetchAsset } from "../services/stockService";
import AssetCodeBlock from "../components/AssetCodeBlock";

interface AssetDetails {
  id: string;
  asset_name: string;
  asset_tag: string;
  serial_number: string;
  brand?: string | null;
  model?: string | null;
  description?: string | null;
  status:
    | "in_stock"
    | "assigned"
    | "in_repair"
    | "retired"
    | "lost"
    | "disposed";
  condition?: string | null;
  purchase_price?: number | null;
  currency?: string | null;
  purchase_date?: string | null;
  warranty_expiry_date?: string | null;
  invoice_number?: string | null;
  reference_number?: string | null;
  insured?: boolean | null;
  insurance_provider?: string | null;
  insurance_policy_number?: string | null;
  insurance_expiry_date?: string | null;
  sub_location?: string | null;
  asset_image_url?: string | null;
  site_image_url?: string | null;
  notes?: string | null;
  created_at: string;
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
  assigned_profile?: {
    id: string;
    full_name?: string | null;
    email?: string | null;
  } | null;
}

function InfoCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-white/10 bg-black p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="border border-orange-500/20 bg-orange-500/10 p-2 text-orange-300">
          {icon}
        </div>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-2 border-b border-white/5 py-3 md:grid-cols-[180px_1fr]">
      <div className="text-sm text-zinc-400">{label}</div>
      <div className="text-sm text-white">{value || "—"}</div>
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
}

function formatMoney(amount?: number | null, currency = "USD") {
  if (amount === null || amount === undefined) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(amount);
}

export default function AssetDetailsPage() {
  const { assetId } = useParams();
  const auth = useAuth();
  const user = auth?.user ?? null;
  const profile = auth?.profile ?? null;

  const [asset, setAsset] = useState<AssetDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  useEffect(() => {
    async function loadAsset() {
      if (!assetId) return;

      setLoading(true);
      setError("");

      try {
        const data = await fetchAsset(assetId);
        setAsset(data as unknown as AssetDetails);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load asset.");
      } finally {
        setLoading(false);
      }
    }

    void loadAsset();
  }, [assetId]);

  if (!user || !profile) return null;

  return (
    <div className="min-h-screen bg-black text-white lg:flex">
      <Sidebar role={profile.primary_role} />

      <main className="flex-1 px-4 pt-4 pb-8 md:px-6">
        <div className="space-y-6">
          <section className="border border-white/10 bg-black p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <button
                  type="button"
                  onClick={() => window.history.back()}
                  className="mb-4 inline-flex items-center gap-2 border border-white/10 px-4 py-2 text-sm text-zinc-200 hover:border-white/20 hover:text-white"
                >
                  <ArrowLeft size={16} />
                  Back
                </button>

                <p className="text-sm uppercase tracking-wide text-orange-300">
                  Asset Profile
                </p>
                <h1 className="mt-2 text-3xl font-semibold text-white">
                  {asset?.asset_name ?? "Asset Details"}
                </h1>
                <p className="mt-3 text-sm text-zinc-400">
                  View printable asset information, purchase details, site,
                  insurance, barcode, QR code, and assignment data.
                </p>
              </div>

              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 border border-orange-500 bg-orange-500 px-4 py-3 text-sm font-medium text-black hover:bg-orange-400"
              >
                <Printer size={16} />
                Print Asset Info
              </button>
            </div>
          </section>

          {loading ? (
            <section className="border border-white/10 bg-black p-5 text-sm text-zinc-300">
              Loading asset...
            </section>
          ) : null}

          {error ? (
            <section className="border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-300">
              {error}
            </section>
          ) : null}

          {!loading && !error && asset ? (
            <>
              <section className="grid gap-6 xl:grid-cols-[320px_1fr]">
                <div className="border border-white/10 bg-black p-5">
                  <div className="aspect-square overflow-hidden border border-white/10 bg-zinc-950">
                    {asset.asset_image_url ? (
                      <img
                        src={asset.asset_image_url}
                        alt={asset.asset_name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                        No asset image
                      </div>
                    )}
                  </div>

                  <div className="mt-5 space-y-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-zinc-500">
                        Asset Tag
                      </p>
                      <p className="mt-1 text-lg font-semibold text-white">
                        {asset.asset_tag || "—"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-wide text-zinc-500">
                        Serial Number
                      </p>
                      <p className="mt-1 text-sm text-white">
                        {asset.serial_number || "—"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-wide text-zinc-500">
                        Status
                      </p>
                      <p className="mt-1 text-sm capitalize text-white">
                        {asset.status.replace(/_/g, " ")}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-wide text-zinc-500">
                        Condition
                      </p>
                      <p className="mt-1 text-sm capitalize text-white">
                        {asset.condition || "—"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <InfoCard
                    title="Asset Information"
                    icon={<Package size={18} />}
                  >
                    <Row label="Asset Name" value={asset.asset_name} />
                    <Row label="Category" value={asset.category?.name} />
                    <Row label="Brand" value={asset.brand} />
                    <Row label="Model" value={asset.model} />
                    <Row label="Description" value={asset.description} />
                    <Row label="Notes" value={asset.notes} />
                  </InfoCard>

                  <InfoCard
                    title="Purchase Details"
                    icon={<Receipt size={18} />}
                  >
                    <Row
                      label="Asset Price"
                      value={formatMoney(
                        asset.purchase_price,
                        asset.currency || "USD",
                      )}
                    />
                    <Row label="Currency" value={asset.currency} />
                    <Row
                      label="Purchase Date"
                      value={formatDate(asset.purchase_date)}
                    />
                    <Row label="Invoice Number" value={asset.invoice_number} />
                    <Row
                      label="Reference Number"
                      value={asset.reference_number}
                    />
                    <Row
                      label="Warranty Expiry"
                      value={formatDate(asset.warranty_expiry_date)}
                    />
                  </InfoCard>
                </div>
              </section>

              <section className="grid gap-6 xl:grid-cols-2">
                <InfoCard title="Location / Site" icon={<MapPin size={18} />}>
                  <Row label="Site" value={asset.location?.name} />
                  <Row label="Sub-location" value={asset.sub_location} />
                  <Row
                    label="Assigned To"
                    value={
                      asset.assigned_profile?.full_name ||
                      asset.assigned_profile?.email ||
                      "—"
                    }
                  />

                  <div className="mt-4">
                    <p className="mb-3 text-sm text-zinc-400">Site Image</p>
                    <div className="overflow-hidden border border-white/10 bg-zinc-950">
                      {asset.location?.image_url || asset.site_image_url ? (
                        <img
                          src={
                            asset.location?.image_url ||
                            asset.site_image_url ||
                            ""
                          }
                          alt={asset.location?.name || "Site"}
                          className="h-56 w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-56 items-center justify-center text-sm text-zinc-500">
                          No site image
                        </div>
                      )}
                    </div>
                  </div>
                </InfoCard>

                <InfoCard title="Insurance" icon={<Shield size={18} />}>
                  <Row label="Insured" value={asset.insured ? "Yes" : "No"} />
                  <Row
                    label="Insurance Provider"
                    value={asset.insurance_provider}
                  />
                  <Row
                    label="Policy Number"
                    value={asset.insurance_policy_number}
                  />
                  <Row
                    label="Insurance Expiry"
                    value={formatDate(asset.insurance_expiry_date)}
                  />
                </InfoCard>
              </section>

              <AssetCodeBlock assetTag={asset.asset_tag} assetId={asset.id} />

              <section className="grid gap-6 xl:grid-cols-2">
                <InfoCard title="System Information" icon={<User size={18} />}>
                  <Row
                    label="Created By"
                    value={
                      asset.created_profile?.full_name ||
                      asset.created_profile?.email ||
                      "—"
                    }
                  />
                  <Row
                    label="Created At"
                    value={formatDate(asset.created_at)}
                  />
                </InfoCard>

                <InfoCard
                  title="Tracking Dates"
                  icon={<CalendarDays size={18} />}
                >
                  <Row
                    label="Purchase Date"
                    value={formatDate(asset.purchase_date)}
                  />
                  <Row
                    label="Warranty Expiry"
                    value={formatDate(asset.warranty_expiry_date)}
                  />
                  <Row
                    label="Insurance Expiry"
                    value={formatDate(asset.insurance_expiry_date)}
                  />
                </InfoCard>
              </section>
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}
