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

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString();
}

function sanitizeFilenamePart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "");
}

function buildAssetRows(assets: AssetRow[]) {
  return assets.map((asset) => ({
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
    "Purchase Date": formatDate(asset.purchase_date),
    "Warranty Expiry": formatDate(asset.warranty_expiry_date),
    "Invoice Number": asset.invoice_number ?? "",
    "Reference Number": asset.reference_number ?? "",
    Insured: asset.insured ? "Yes" : "No",
    "Insurance Provider": asset.insurance_provider ?? "",
    "Policy Number": asset.insurance_policy_number ?? "",
    "Insurance Expiry": formatDate(asset.insurance_expiry_date),
    Notes: asset.notes ?? "",
    "Created By":
      asset.created_profile?.full_name || asset.created_profile?.email || "",
    "Created At": formatDate(asset.created_at),
  }));
}

export function exportAssetsToExcel(
  assets: AssetRow[],
  options?: {
    filename?: string;
    sheetName?: string;
  },
) {
  const rows = buildAssetRows(assets);
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    options?.sheetName ?? "Assets",
  );

  const excelBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  });

  const blob = new Blob([excelBuffer], {
    type:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
  });

  const filename =
    options?.filename ??
    `assets-export-${new Date().toISOString().slice(0, 10)}.xlsx`;

  saveAs(blob, filename);
}

export function exportAssetWorkbook(params: {
  summaryTitle: string;
  summaryLines: string[];
  assets: AssetRow[];
  attentionAssets?: AssetRow[];
  filename?: string;
}) {
  const workbook = XLSX.utils.book_new();

  const summaryRows = params.summaryLines.map((line) => ({
    Summary: line,
  }));
  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

  const assetsSheet = XLSX.utils.json_to_sheet(buildAssetRows(params.assets));
  XLSX.utils.book_append_sheet(workbook, assetsSheet, "Assets");

  if (params.attentionAssets && params.attentionAssets.length > 0) {
    const attentionSheet = XLSX.utils.json_to_sheet(
      buildAssetRows(params.attentionAssets),
    );
    XLSX.utils.book_append_sheet(workbook, attentionSheet, "Needs Attention");
  }

  const excelBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  });

  const blob = new Blob([excelBuffer], {
    type:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
  });

  const fallbackName = `${sanitizeFilenamePart(params.summaryTitle)}-${new Date()
    .toISOString()
    .slice(0, 10)}.xlsx`;

  saveAs(blob, params.filename ?? fallbackName);
}

export function downloadTextReport(title: string, content: string) {
  const blob = new Blob([`${title}\n\n${content}`], {
    type: "text/plain;charset=utf-8",
  });

  saveAs(
    blob,
    `${sanitizeFilenamePart(title)}-${new Date().toISOString().slice(0, 10)}.txt`,
  );
}

export function printTextReport(title: string, content: string) {
  const printWindow = window.open("", "_blank", "width=900,height=700");

  if (!printWindow) {
    throw new Error("Unable to open print window.");
  }

  const escapedTitle = title
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

  const escapedContent = content
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

  printWindow.document.write(`
    <html>
      <head>
        <title>${escapedTitle}</title>
        <style>
          body {
            font-family: Arial, Helvetica, sans-serif;
            padding: 32px;
            color: #111;
            background: #fff;
            line-height: 1.6;
          }

          .page {
            max-width: 900px;
            margin: 0 auto;
          }

          h1 {
            font-size: 24px;
            margin: 0 0 16px;
          }

          .date {
            margin-bottom: 24px;
            color: #555;
            font-size: 13px;
          }

          pre {
            white-space: pre-wrap;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 14px;
            margin: 0;
          }
        </style>
      </head>
      <body>
        <div class="page">
          <h1>${escapedTitle}</h1>
          <div class="date">Generated on ${new Date().toLocaleString()}</div>
          <pre>${escapedContent}</pre>
        </div>
      </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}