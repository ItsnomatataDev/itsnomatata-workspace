import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

interface AssetRow {
  asset_name?: string | null;
  asset_tag?: string | null;
  serial_number?: string | null;
  brand?: string | null;
  model?: string | null;
  status?: string | null;
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
  notes?: string | null;
  category?: { name?: string | null } | null;
  location?: { name?: string | null; code?: string | null } | null;
  assigned_profile?: { full_name?: string | null; email?: string | null } | null;
  created_profile?: { full_name?: string | null; email?: string | null } | null;
  created_at?: string | null;
}

export function exportAssetsToExcel(assets: AssetRow[]) {
  const rows = assets.map((asset) => ({
    "Asset Name": asset.asset_name ?? "",
    "Asset Tag": asset.asset_tag ?? "",
    "Serial Number": asset.serial_number ?? "",
    Brand: asset.brand ?? "",
    Model: asset.model ?? "",
    Category: asset.category?.name ?? "",
    Site: asset.location?.name ?? "",
    "Site Code": asset.location?.code ?? "",
    "Sub-location": asset.sub_location ?? "",
    Status: asset.status ?? "",
    Condition: asset.condition ?? "",
    "Assigned To":
      asset.assigned_profile?.full_name || asset.assigned_profile?.email || "",
    "Purchase Price": asset.purchase_price ?? "",
    Currency: asset.currency ?? "",
    "Purchase Date": asset.purchase_date ?? "",
    "Warranty Expiry": asset.warranty_expiry_date ?? "",
    "Invoice Number": asset.invoice_number ?? "",
    "Reference Number": asset.reference_number ?? "",
    Insured: asset.insured ? "Yes" : "No",
    "Insurance Provider": asset.insurance_provider ?? "",
    "Policy Number": asset.insurance_policy_number ?? "",
    "Insurance Expiry": asset.insurance_expiry_date ?? "",
    Notes: asset.notes ?? "",
    "Created By":
      asset.created_profile?.full_name || asset.created_profile?.email || "",
    "Created At": asset.created_at ?? "",
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, "Assets");

  const excelBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  });

  const blob = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
  });

  saveAs(blob, `assets-export-${new Date().toISOString().slice(0, 10)}.xlsx`);
}