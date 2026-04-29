import * as XLSX from "xlsx";
import type { CreateAssetInput } from "../../../lib/supabase/mutations/assets";

export interface ImportedAssetRow {
  asset_name: string;
  asset_tag?: string | null;
  serial_number: string;
  category_name?: string | null;
  location_name?: string | null;
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
  purchase_batch_name?: string | null;
}

export interface AssetImportInvalidRow {
  rowNumber: number;
  errors: string[];
  warnings: string[];
  skipped: boolean;
  skipReason?: string;
  row: Record<string, unknown>;
}

export interface AssetImportParseResult {
  validRows: ImportedAssetRow[];
  invalidRows: AssetImportInvalidRow[];
  headers: string[];
}

export interface LookupOption {
  id: string;
  name: string;
}

export interface PurchaseBatchOption {
  id: string;
  label: string;
}

function normalizeString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function normalizeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;

  if (typeof value === "number") {
    return value === 1;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["yes", "true", "1", "y"].includes(normalized);
  }

  return false;
}

function normalizeDateString(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;

    const year = String(parsed.y).padStart(4, "0");
    const month = String(parsed.m).padStart(2, "0");
    const day = String(parsed.d).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const text = String(value).trim();
  if (!text) return null;

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    return text;
  }

  return date.toISOString().slice(0, 10);
}

function normalizeAssetTag(value?: string | null): string {
  return value?.trim().toLowerCase() || "";
}

function findHeaderValue(
  row: Record<string, unknown>,
  aliases: string[],
): unknown {
  const keys = Object.keys(row);

  for (const alias of aliases) {
    const exact = keys.find((key) => key === alias);
    if (exact) return row[exact];
  }

  const lowered = keys.reduce<Record<string, string>>((acc, key) => {
    acc[key.toLowerCase()] = key;
    return acc;
  }, {});

  for (const alias of aliases) {
    const match = lowered[alias.toLowerCase()];
    if (match) return row[match];
  }

  return undefined;
}

function buildImportedRow(row: Record<string, unknown>): ImportedAssetRow {
  return {
    asset_name:
      normalizeString(findHeaderValue(row, ["asset_name", "Asset Name"])) ?? "",
    asset_tag: normalizeString(findHeaderValue(row, ["asset_tag", "Asset Tag"])),
    serial_number:
      normalizeString(findHeaderValue(row, ["serial_number", "Serial Number"])) ??
      "",
    category_name: normalizeString(
      findHeaderValue(row, ["category_name", "Category", "Category Name"]),
    ),
    location_name: normalizeString(
      findHeaderValue(row, ["location_name", "Site", "Location", "Site Name"]),
    ),
    brand: normalizeString(findHeaderValue(row, ["brand", "Brand"])),
    model: normalizeString(findHeaderValue(row, ["model", "Model"])),
    description: normalizeString(
      findHeaderValue(row, ["description", "Description"]),
    ),
    purchase_price: normalizeNumber(
      findHeaderValue(row, ["purchase_price", "Purchase Price"]),
    ),
    currency:
      normalizeString(findHeaderValue(row, ["currency", "Currency"])) ?? "USD",
    purchase_date: normalizeDateString(
      findHeaderValue(row, ["purchase_date", "Purchase Date"]),
    ),
    warranty_expiry_date: normalizeDateString(
      findHeaderValue(row, ["warranty_expiry_date", "Warranty Expiry"]),
    ),
    expected_life_months: normalizeNumber(
      findHeaderValue(row, ["expected_life_months", "Expected Life (Months)"]),
    ),
    invoice_number: normalizeString(
      findHeaderValue(row, ["invoice_number", "Invoice Number"]),
    ),
    reference_number: normalizeString(
      findHeaderValue(row, ["reference_number", "Reference Number"]),
    ),
    insured: normalizeBoolean(findHeaderValue(row, ["insured", "Insured"])),
    insurance_provider: normalizeString(
      findHeaderValue(row, ["insurance_provider", "Insurance Provider"]),
    ),
    insurance_policy_number: normalizeString(
      findHeaderValue(row, ["insurance_policy_number", "Policy Number"]),
    ),
    insurance_expiry_date: normalizeDateString(
      findHeaderValue(row, ["insurance_expiry_date", "Insurance Expiry"]),
    ),
    sub_location: normalizeString(
      findHeaderValue(row, ["sub_location", "Sub-location"]),
    ),
    barcode_value: normalizeString(
      findHeaderValue(row, ["barcode_value", "Barcode Value"]),
    ),
    qr_code_value: normalizeString(
      findHeaderValue(row, ["qr_code_value", "QR Code Value"]),
    ),
    asset_image_url: normalizeString(
      findHeaderValue(row, ["asset_image_url", "Asset Photo URL"]),
    ),
    site_image_url: normalizeString(
      findHeaderValue(row, ["site_image_url", "Site Picture URL"]),
    ),
    notes: normalizeString(findHeaderValue(row, ["notes", "Notes"])),
    purchase_batch_name: normalizeString(
      findHeaderValue(row, ["purchase_batch_name", "Purchase Batch"]),
    ),
  };
}

function validateImportedRow(row: ImportedAssetRow): string[] {
  const errors: string[] = [];

  if (!row.asset_name?.trim()) {
    errors.push("Asset name is required.");
  }

  if (!row.serial_number?.trim()) {
    errors.push("Serial number is required.");
  }

  return errors;
}

function validateImportedRowWarnings(row: ImportedAssetRow, seenSerials: Map<string, number>, rowIndex: number): string[] {
  const warnings: string[] = [];

  const normalizedSerial = row.serial_number?.trim().toLowerCase();
  if (normalizedSerial) {
    const existingRowNumber = seenSerials.get(normalizedSerial);
    if (existingRowNumber) {
      warnings.push(
        `Serial number "${row.serial_number}" is duplicated in this file. It already appears on row ${existingRowNumber}.`
      );
    } else {
      seenSerials.set(normalizedSerial, rowIndex);
    }
  }

  return warnings;
}

export async function parseAssetImportFile(
  file: File,
): Promise<AssetImportParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error("The uploaded file has no worksheet.");
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: "",
  });

  const validRows: ImportedAssetRow[] = [];
  const invalidRows: AssetImportInvalidRow[] = [];
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const seenTags = new Map<string, number>();
  const seenSerials = new Map<string, number>();

  rows.forEach((row, index) => {
    const normalized = buildImportedRow(row);
    const errors = validateImportedRow(normalized);
    const warnings = validateImportedRowWarnings(normalized, seenSerials, index + 2);

    const normalizedTag = normalizeAssetTag(normalized.asset_tag);

    if (normalizedTag) {
      const existingRowNumber = seenTags.get(normalizedTag);

      if (existingRowNumber) {
        errors.push(
          `Asset tag "${normalized.asset_tag}" is duplicated in this file. It already appears on row ${existingRowNumber}.`,
        );
      } else {
        seenTags.set(normalizedTag, index + 2);
      }
    }

    if (errors.length > 0) {
      invalidRows.push({
        rowNumber: index + 2,
        errors,
        warnings,
        skipped: false,
        row,
      });
      return;
    }

    // Even if there are warnings (like duplicate serial), still add to valid rows
    validRows.push(normalized);
  });

  return {
    validRows,
    invalidRows,
    headers,
  };
}

function findLookupIdByName(
  items: LookupOption[],
  value?: string | null,
): string | null {
  if (!value) return null;

  const normalized = value.trim().toLowerCase();

  const match = items.find(
    (item) => item.name.trim().toLowerCase() === normalized,
  );

  return match?.id ?? null;
}

function findBatchIdByLabel(
  items: PurchaseBatchOption[],
  value?: string | null,
): string | null {
  if (!value) return null;

  const normalized = value.trim().toLowerCase();

  const match = items.find(
    (item) => item.label.trim().toLowerCase() === normalized,
  );

  return match?.id ?? null;
}

export async function buildCreateAssetInputsFromImport(params: {
  rows: ImportedAssetRow[];
  organizationId: string;
  userId?: string | null;
  categories: LookupOption[];
  locations: LookupOption[];
  purchaseBatches: PurchaseBatchOption[];
  createPurchaseBatch?: (label: string) => Promise<string>;
}): Promise<{
  assets: CreateAssetInput[];
  unresolvedRows: AssetImportInvalidRow[];
}> {
  const assets: CreateAssetInput[] = [];
  const unresolvedRows: AssetImportInvalidRow[] = [];
  const seenPreparedTags = new Map<string, number>();

  for (let index = 0; index < params.rows.length; index += 1) {
    const row = params.rows[index];
    const errors: string[] = [];

    const categoryId = findLookupIdByName(params.categories, row.category_name);
    const locationId = findLookupIdByName(params.locations, row.location_name);

    let purchaseBatchId = findBatchIdByLabel(
      params.purchaseBatches,
      row.purchase_batch_name,
    );

    if (row.category_name && !categoryId) {
      errors.push(`Category "${row.category_name}" was not found.`);
    }

    if (row.location_name && !locationId) {
      errors.push(`Location "${row.location_name}" was not found.`);
    }

    if (
      row.purchase_batch_name &&
      !purchaseBatchId &&
      params.createPurchaseBatch
    ) {
      try {
        purchaseBatchId = await params.createPurchaseBatch(row.purchase_batch_name);
      } catch (error) {
        errors.push(
          error instanceof Error
            ? error.message
            : `Failed to create purchase batch "${row.purchase_batch_name}".`,
        );
      }
    }

    if (row.purchase_batch_name && !purchaseBatchId) {
      errors.push(`Purchase batch "${row.purchase_batch_name}" was not found.`);
    }

    const normalizedTag = normalizeAssetTag(row.asset_tag);
    if (normalizedTag) {
      const existingRowNumber = seenPreparedTags.get(normalizedTag);

      if (existingRowNumber) {
        errors.push(
          `Asset tag "${row.asset_tag}" is duplicated in the prepared import set. It also appears on row ${existingRowNumber}.`,
        );
      } else {
        seenPreparedTags.set(normalizedTag, index + 2);
      }
    }

    if (errors.length > 0) {
      unresolvedRows.push({
        rowNumber: index + 2,
        errors,
        warnings: [],
        skipped: false,
        row: row as unknown as Record<string, unknown>,
      });
      continue;
    }

    assets.push({
      organization_id: params.organizationId,
      created_by: params.userId ?? null,
      asset_name: row.asset_name.trim(),
      asset_tag: row.asset_tag?.trim() || null,
      serial_number: row.serial_number.trim(),
      purchase_batch_id: purchaseBatchId || null,
      category_id: categoryId || null,
      current_location_id: locationId || null,
      brand: row.brand?.trim() || null,
      model: row.model?.trim() || null,
      description: row.description?.trim() || null,
      purchase_price: row.purchase_price ?? null,
      currency: row.currency?.trim() || "USD",
      purchase_date: row.purchase_date || null,
      warranty_expiry_date: row.warranty_expiry_date || null,
      expected_life_months: row.expected_life_months ?? null,
      invoice_number: row.invoice_number?.trim() || null,
      reference_number: row.reference_number?.trim() || null,
      insured: row.insured ?? false,
      insurance_provider: row.insurance_provider?.trim() || null,
      insurance_policy_number: row.insurance_policy_number?.trim() || null,
      insurance_expiry_date: row.insurance_expiry_date || null,
      sub_location: row.sub_location?.trim() || null,
      barcode_value: row.barcode_value?.trim() || null,
      qr_code_value: row.qr_code_value?.trim() || null,
      asset_image_url: row.asset_image_url?.trim() || null,
      site_image_url: row.site_image_url?.trim() || null,
      notes: row.notes?.trim() || null,
    });
  }

  return {
    assets,
    unresolvedRows,
  };
}