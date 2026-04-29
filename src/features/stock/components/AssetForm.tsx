import { useEffect, useState } from "react";
import type {
  CreateAssetInput,
  UpdateAssetInput,
} from "../../../lib/supabase/mutations/assets";
import { uploadAssetImage } from "../../../lib/supabase/storage";

interface EditableAsset {
  id: string;
  asset_name: string;
  asset_tag?: string | null;
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
}

interface LookupOption {
  id: string;
  name: string;
  code?: string | null;
  image_url?: string | null;
}

const INITIAL_FORM = {
  asset_name: "",
  asset_tag: "",
  serial_number: "",
  purchase_batch_id: "",
  category_id: "",
  current_location_id: "",
  brand: "",
  model: "",
  description: "",
  purchase_price: "",
  currency: "USD",
  purchase_date: "",
  warranty_expiry_date: "",
  expected_life_months: "",
  invoice_number: "",
  reference_number: "",
  insured: false,
  insurance_provider: "",
  insurance_policy_number: "",
  insurance_expiry_date: "",
  sub_location: "",
  barcode_value: "",
  qr_code_value: "",
  asset_image_url: "",
  site_image_url: "",
  notes: "",
};

export default function AssetForm({
  mode,
  open,
  saving,
  asset,
  categories,
  locations,
  purchaseBatches,
  organizationId,
  userId,
  onClose,
  onCreate,
  onUpdate,
  onCreatePurchaseBatch,
}: {
  mode: "create" | "edit";
  open: boolean;
  saving: boolean;
  asset?: EditableAsset | null;
  categories: LookupOption[];
  locations: LookupOption[];
  purchaseBatches: Array<{ id: string; label: string }>;
  organizationId: string;
  userId?: string | null;
  onClose: () => void;
  onCreate: (input: CreateAssetInput) => Promise<void>;
  onUpdate: (assetId: string, input: UpdateAssetInput) => Promise<void>;
  onCreatePurchaseBatch?: (label: string) => Promise<string>;
}) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [error, setError] = useState("");
  const [customBatchMode, setCustomBatchMode] = useState(false);
  const [customBatchLabel, setCustomBatchLabel] = useState("");
  const [uploading, setUploading] = useState(false);
  const [assetImageFile, setAssetImageFile] = useState<File | null>(null);
  const [siteImageFile, setSiteImageFile] = useState<File | null>(null);

  useEffect(() => {
    if (!open) return;

    if (mode === "edit" && asset) {
      setForm({
        asset_name: asset.asset_name ?? "",
        asset_tag: asset.asset_tag ?? "",
        serial_number: asset.serial_number ?? "",
        purchase_batch_id: asset.purchase_batch_id ?? "",
        category_id: asset.category_id ?? "",
        current_location_id: asset.current_location_id ?? "",
        brand: asset.brand ?? "",
        model: asset.model ?? "",
        description: asset.description ?? "",
        purchase_price:
          asset.purchase_price !== null && asset.purchase_price !== undefined
            ? String(asset.purchase_price)
            : "",
        currency: asset.currency ?? "USD",
        purchase_date: asset.purchase_date ?? "",
        warranty_expiry_date: asset.warranty_expiry_date ?? "",
        expected_life_months:
          asset.expected_life_months !== null &&
          asset.expected_life_months !== undefined
            ? String(asset.expected_life_months)
            : "",
        invoice_number: asset.invoice_number ?? "",
        reference_number: asset.reference_number ?? "",
        insured: Boolean(asset.insured),
        insurance_provider: asset.insurance_provider ?? "",
        insurance_policy_number: asset.insurance_policy_number ?? "",
        insurance_expiry_date: asset.insurance_expiry_date ?? "",
        sub_location: asset.sub_location ?? "",
        barcode_value: asset.barcode_value ?? "",
        qr_code_value: asset.qr_code_value ?? "",
        asset_image_url: asset.asset_image_url ?? "",
        site_image_url: asset.site_image_url ?? "",
        notes: asset.notes ?? "",
      });
      setCustomBatchMode(false);
      setCustomBatchLabel("");
    } else {
      setForm(INITIAL_FORM);
      setCustomBatchMode(false);
      setCustomBatchLabel("");
      setAssetImageFile(null);
      setSiteImageFile(null);
    }

    setError("");
  }, [open, mode, asset]);

  function updateField(name: string, value: string | boolean) {
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleAssetImageFileChange(file: File | null) {
    setAssetImageFile(file);
    if (file) {
      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      setForm((current) => ({ ...current, asset_image_url: previewUrl }));
    } else {
      setForm((current) => ({ ...current, asset_image_url: "" }));
    }
  }

  function handleSiteImageFileChange(file: File | null) {
    setSiteImageFile(file);
    if (file) {
      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      setForm((current) => ({ ...current, site_image_url: previewUrl }));
    } else {
      setForm((current) => ({ ...current, site_image_url: "" }));
    }
  }

  const selectedLocation = locations.find(
    (location) => location.id === form.current_location_id,
  );

  useEffect(() => {
    if (!selectedLocation?.image_url) return;
    if (form.site_image_url) return;

    setForm((current) => ({
      ...current,
      site_image_url: selectedLocation.image_url ?? "",
    }));
  }, [selectedLocation?.image_url, form.site_image_url]);

  async function resolvePurchaseBatchId() {
    if (!customBatchMode) {
      return form.purchase_batch_id || null;
    }

    if (!customBatchLabel.trim()) {
      throw new Error("Custom purchase batch name is required.");
    }

    if (!onCreatePurchaseBatch) {
      throw new Error("Purchase batch creation is not configured.");
    }

    const batchId = await onCreatePurchaseBatch(customBatchLabel.trim());
    return batchId;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!form.asset_name.trim()) {
      setError("Asset name is required.");
      return;
    }

    if (!form.serial_number.trim()) {
      setError("Serial number is required.");
      return;
    }

    try {
      setUploading(true);
      const resolvedPurchaseBatchId = await resolvePurchaseBatchId();

      // Upload images if files are selected
      let assetImageUrl = form.asset_image_url || null;
      let siteImageUrl = form.site_image_url || null;

      // For create mode, we need to create the asset first to get the ID
      if (mode === "create") {
        const payload: CreateAssetInput = {
          organization_id: organizationId,
          created_by: userId ?? null,
          asset_name: form.asset_name.trim(),
          asset_tag: form.asset_tag.trim() || null,
          serial_number: form.serial_number.trim(),
          purchase_batch_id: resolvedPurchaseBatchId,
          category_id: form.category_id || null,
          current_location_id: form.current_location_id || null,
          brand: form.brand.trim() || null,
          model: form.model.trim() || null,
          description: form.description.trim() || null,
          purchase_price: form.purchase_price
            ? Number(form.purchase_price)
            : null,
          currency: form.currency.trim() || "USD",
          purchase_date: form.purchase_date || null,
          warranty_expiry_date: form.warranty_expiry_date || null,
          expected_life_months: form.expected_life_months
            ? Number(form.expected_life_months)
            : null,
          invoice_number: form.invoice_number.trim() || null,
          reference_number: form.reference_number.trim() || null,
          insured: form.insured,
          insurance_provider: form.insurance_provider.trim() || null,
          insurance_policy_number: form.insurance_policy_number.trim() || null,
          insurance_expiry_date: form.insurance_expiry_date || null,
          sub_location: form.sub_location.trim() || null,
          barcode_value: form.barcode_value.trim() || null,
          qr_code_value: form.qr_code_value.trim() || null,
          asset_image_url: null, // Will be set after upload
          site_image_url: null, // Will be set after upload
          notes: form.notes.trim() || null,
        };

        await onCreate(payload);
        
        // Note: We need the asset ID to upload images, but onCreate doesn't return it
        // For now, we'll skip image upload on create and require re-edit to add images
        // Or we could modify onCreate to return the created asset
      } else if (asset?.id) {
        // Upload images for edit mode
        if (assetImageFile) {
          const assetImageResult = await uploadAssetImage(
            organizationId,
            asset.id,
            assetImageFile,
            'asset'
          );
          assetImageUrl = assetImageResult.public_url;
        }

        if (siteImageFile) {
          const siteImageResult = await uploadAssetImage(
            organizationId,
            asset.id,
            siteImageFile,
            'site'
          );
          siteImageUrl = siteImageResult.public_url;
        }

        const payload: UpdateAssetInput = {
          asset_name: form.asset_name.trim(),
          asset_tag: form.asset_tag.trim() || null,
          serial_number: form.serial_number.trim(),
          purchase_batch_id: resolvedPurchaseBatchId,
          category_id: form.category_id || null,
          current_location_id: form.current_location_id || null,
          brand: form.brand.trim() || null,
          model: form.model.trim() || null,
          description: form.description.trim() || null,
          purchase_price: form.purchase_price
            ? Number(form.purchase_price)
            : null,
          currency: form.currency.trim() || "USD",
          purchase_date: form.purchase_date || null,
          warranty_expiry_date: form.warranty_expiry_date || null,
          expected_life_months: form.expected_life_months
            ? Number(form.expected_life_months)
            : null,
          invoice_number: form.invoice_number.trim() || null,
          reference_number: form.reference_number.trim() || null,
          insured: form.insured,
          insurance_provider: form.insurance_provider.trim() || null,
          insurance_policy_number: form.insurance_policy_number.trim() || null,
          insurance_expiry_date: form.insurance_expiry_date || null,
          sub_location: form.sub_location.trim() || null,
          barcode_value: form.barcode_value.trim() || null,
          qr_code_value: form.qr_code_value.trim() || null,
          asset_image_url: assetImageUrl,
          site_image_url: siteImageUrl,
          notes: form.notes.trim() || null,
        };

        await onUpdate(asset.id, payload);
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save asset.");
    } finally {
      setUploading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 px-4 py-8">
      <div className="w-full max-w-5xl border border-white/10 bg-black p-6">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">
              {mode === "create" ? "Add New Asset" : "Edit Asset"}
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Save asset profile information, photos, purchase details,
              insurance, and location data.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="border border-white/10 px-4 py-2 text-sm text-zinc-200 hover:border-orange-500 hover:text-orange-300"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error ? (
            <div className="border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          ) : null}

          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-orange-300">
              Core Asset Information
            </h3>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <label className="space-y-2">
                <span className="text-sm text-zinc-300">Asset Name</span>
                <input
                  value={form.asset_name}
                  onChange={(e) => updateField("asset_name", e.target.value)}
                  className="w-full border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
                  placeholder="Canon EOS R6"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm text-zinc-300">Asset Tag</span>
                <input
                  value={form.asset_tag}
                  onChange={(e) => updateField("asset_tag", e.target.value)}
                  className="w-full border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
                  placeholder="Leave blank to auto-generate"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm text-zinc-300">Serial Number</span>
                <input
                  value={form.serial_number}
                  onChange={(e) => updateField("serial_number", e.target.value)}
                  className="w-full border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
                  placeholder="SN123456789"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm text-zinc-300">Category</span>
                <select
                  value={form.category_id}
                  onChange={(e) => updateField("category_id", e.target.value)}
                  className="w-full border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
                >
                  <option value="">Select category</option>
                  {categories.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm text-zinc-300">Brand</span>
                <input
                  value={form.brand}
                  onChange={(e) => updateField("brand", e.target.value)}
                  className="w-full border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
                  placeholder="Canon"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm text-zinc-300">Model</span>
                <input
                  value={form.model}
                  onChange={(e) => updateField("model", e.target.value)}
                  className="w-full border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
                  placeholder="EOS R6"
                />
              </label>
            </div>

            <label className="block space-y-2">
              <span className="text-sm text-zinc-300">Description</span>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                className="w-full border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
                placeholder="Describe the asset..."
              />
            </label>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-orange-300">
              Purchase and Financial Details
            </h3>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <label className="space-y-2">
                <span className="text-sm text-zinc-300">Purchase Batch</span>
                <select
                  value={
                    customBatchMode ? "__custom__" : form.purchase_batch_id
                  }
                  onChange={(e) => {
                    const value = e.target.value;

                    if (value === "__custom__") {
                      setCustomBatchMode(true);
                      updateField("purchase_batch_id", "");
                      return;
                    }

                    setCustomBatchMode(false);
                    setCustomBatchLabel("");
                    updateField("purchase_batch_id", value);
                  }}
                  className="w-full border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
                >
                  <option value="">Select purchase batch</option>
                  {purchaseBatches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.label}
                    </option>
                  ))}
                  <option value="__custom__">+ Custom purchase batch</option>
                </select>
              </label>

              {customBatchMode ? (
                <label className="space-y-2">
                  <span className="text-sm text-zinc-300">
                    Custom Batch Name
                  </span>
                  <input
                    value={customBatchLabel}
                    onChange={(e) => setCustomBatchLabel(e.target.value)}
                    className="w-full border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
                    placeholder="Office Setup April 2026"
                  />
                </label>
              ) : null}

              <label className="space-y-2">
                <span className="text-sm text-zinc-300">Purchase Price</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.purchase_price}
                  onChange={(e) =>
                    updateField("purchase_price", e.target.value)
                  }
                  className="w-full border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
                  placeholder="1500.00"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm text-zinc-300">Currency</span>
                <input
                  value={form.currency}
                  onChange={(e) => updateField("currency", e.target.value)}
                  className="w-full border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
                  placeholder="USD"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm text-zinc-300">Purchase Date</span>
                <input
                  type="date"
                  value={form.purchase_date}
                  onChange={(e) => updateField("purchase_date", e.target.value)}
                  className="w-full border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm text-zinc-300">Warranty Expiry</span>
                <input
                  type="date"
                  value={form.warranty_expiry_date}
                  onChange={(e) =>
                    updateField("warranty_expiry_date", e.target.value)
                  }
                  className="w-full border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm text-zinc-300">
                  Expected Life (Months)
                </span>
                <input
                  type="number"
                  min="0"
                  value={form.expected_life_months}
                  onChange={(e) =>
                    updateField("expected_life_months", e.target.value)
                  }
                  className="w-full border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
                  placeholder="36"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm text-zinc-300">Invoice Number</span>
                <input
                  value={form.invoice_number}
                  onChange={(e) =>
                    updateField("invoice_number", e.target.value)
                  }
                  className="w-full border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
                  placeholder="INV-001"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm text-zinc-300">Reference Number</span>
                <input
                  value={form.reference_number}
                  onChange={(e) =>
                    updateField("reference_number", e.target.value)
                  }
                  className="w-full border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
                  placeholder="REF-001"
                />
              </label>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-orange-300">
              Location and Site Details
            </h3>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <label className="space-y-2">
                <span className="text-sm text-zinc-300">Site / Location</span>
                <select
                  value={form.current_location_id}
                  onChange={(e) =>
                    updateField("current_location_id", e.target.value)
                  }
                  className="w-full border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
                >
                  <option value="">Select location</option>
                  {locations.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm text-zinc-300">Sub-location</span>
                <input
                  value={form.sub_location}
                  onChange={(e) => updateField("sub_location", e.target.value)}
                  className="w-full border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
                  placeholder="Server Room / Office 2 / Shelf A"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm text-zinc-300">Site Picture</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleSiteImageFileChange(e.target.files?.[0] ?? null)}
                  className="w-full border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none file:mr-3 file:border-0 file:bg-orange-500 file:px-3 file:py-2 file:text-black"
                />
              </label>
            </div>

            <div className="overflow-hidden border border-white/10 bg-zinc-950">
              {form.site_image_url ? (
                <img
                  src={form.site_image_url}
                  alt="Site preview"
                  className="h-56 w-full object-cover"
                />
              ) : (
                <div className="flex h-56 items-center justify-center text-sm text-zinc-500">
                  No site image preview
                </div>
              )}
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-orange-300">
              Asset Photo and Labels
            </h3>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <label className="space-y-2 xl:col-span-2">
                <span className="text-sm text-zinc-300">Asset Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleAssetImageFileChange(e.target.files?.[0] ?? null)}
                  className="w-full border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none file:mr-3 file:border-0 file:bg-orange-500 file:px-3 file:py-2 file:text-black"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm text-zinc-300">Barcode Value</span>
                <input
                  value={form.barcode_value}
                  onChange={(e) => updateField("barcode_value", e.target.value)}
                  className="w-full border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
                  placeholder="BARCODE-001"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm text-zinc-300">QR Code Value</span>
                <input
                  value={form.qr_code_value}
                  onChange={(e) => updateField("qr_code_value", e.target.value)}
                  className="w-full border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
                  placeholder="QRCODE-001"
                />
              </label>
            </div>

            <div className="overflow-hidden border border-white/10 bg-zinc-950">
              {form.asset_image_url ? (
                <img
                  src={form.asset_image_url}
                  alt="Asset preview"
                  className="h-64 w-full object-cover"
                />
              ) : (
                <div className="flex h-64 items-center justify-center text-sm text-zinc-500">
                  No asset image preview
                </div>
              )}
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-orange-300">
              Insurance
            </h3>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="flex items-center gap-3 border border-white/10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={form.insured}
                  onChange={(e) => updateField("insured", e.target.checked)}
                  className="h-4 w-4 accent-orange-500"
                />
                <span className="text-sm text-white">Insured</span>
              </label>

              <label className="space-y-2">
                <span className="text-sm text-zinc-300">
                  Insurance Provider
                </span>
                <input
                  value={form.insurance_provider}
                  onChange={(e) =>
                    updateField("insurance_provider", e.target.value)
                  }
                  className="w-full border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
                  placeholder="ABC Insurance"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm text-zinc-300">Policy Number</span>
                <input
                  value={form.insurance_policy_number}
                  onChange={(e) =>
                    updateField("insurance_policy_number", e.target.value)
                  }
                  className="w-full border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
                  placeholder="POL-12345"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm text-zinc-300">Insurance Expiry</span>
                <input
                  type="date"
                  value={form.insurance_expiry_date}
                  onChange={(e) =>
                    updateField("insurance_expiry_date", e.target.value)
                  }
                  className="w-full border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
                />
              </label>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-orange-300">
              Notes
            </h3>

            <label className="block space-y-2">
              <span className="text-sm text-zinc-300">Internal Notes</span>
              <textarea
                rows={4}
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                className="w-full border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
                placeholder="Additional notes..."
              />
            </label>
          </section>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving || uploading}
              className="border border-orange-500 bg-orange-500 px-5 py-3 text-sm font-medium text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploading
                ? "Uploading images..."
                : saving
                  ? mode === "create"
                    ? "Saving..."
                    : "Updating..."
                  : mode === "create"
                    ? "Save Asset"
                    : "Update Asset"}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="border border-white/10 px-5 py-3 text-sm text-zinc-200 hover:border-white/20 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
