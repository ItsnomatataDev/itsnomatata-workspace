import { useMemo, useState } from "react";
import {
  buildCreateAssetInputsFromImport,
  parseAssetImportFile,
  type AssetImportInvalidRow,
  type ImportedAssetRow,
  type LookupOption,
  type PurchaseBatchOption,
} from "../services/assetImportService";
import type { CreateAssetInput } from "../../../lib/supabase/mutations/assets";

export default function AssetImportModal({
  open,
  organizationId,
  userId,
  categories,
  locations,
  purchaseBatches,
  saving,
  onClose,
  onImport,
  onCreatePurchaseBatch,
}: {
  open: boolean;
  organizationId: string;
  userId?: string | null;
  categories: LookupOption[];
  locations: LookupOption[];
  purchaseBatches: PurchaseBatchOption[];
  saving: boolean;
  onClose: () => void;
  onImport: (rows: CreateAssetInput[]) => Promise<void>;
  onCreatePurchaseBatch: (label: string) => Promise<string>;
}) {
  const [fileName, setFileName] = useState("");
  const [validRows, setValidRows] = useState<ImportedAssetRow[]>([]);
  const [invalidRows, setInvalidRows] = useState<AssetImportInvalidRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);

  const previewRows = useMemo(() => validRows.slice(0, 6), [validRows]);

  if (!open) return null;

  async function handleFileChange(file: File | null) {
    if (!file) return;

    setParsing(true);
    setError("");
    setFileName(file.name);
    setValidRows([]);
    setInvalidRows([]);
    setHeaders([]);

    try {
      const result = await parseAssetImportFile(file);
      setValidRows(result.validRows);
      setInvalidRows(result.invalidRows);
      setHeaders(result.headers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse file.");
    } finally {
      setParsing(false);
    }
  }

  async function handleImport() {
    setError("");

    if (!validRows.length) {
      setError("There are no valid rows to import.");
      return;
    }

    try {
      const prepared = await buildCreateAssetInputsFromImport({
        rows: validRows,
        organizationId,
        userId,
        categories,
        locations,
        purchaseBatches,
        createPurchaseBatch: onCreatePurchaseBatch,
      });

      if (prepared.unresolvedRows.length > 0) {
        setInvalidRows((current) => [...current, ...prepared.unresolvedRows]);
        setError(
          "Some rows could not be prepared for import. Review the errors below.",
        );
        return;
      }

      await onImport(prepared.assets);

      setFileName("");
      setValidRows([]);
      setInvalidRows([]);
      setHeaders([]);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    }
  }

  function resetStateAndClose() {
    setFileName("");
    setValidRows([]);
    setInvalidRows([]);
    setHeaders([]);
    setError("");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 px-4 py-8">
      <div className="w-full max-w-6xl border border-white/10 bg-black p-6">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">
              Import Assets from Excel
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              Upload an Excel or CSV file, preview valid rows, and import them
              into your stock system.
            </p>
          </div>

          <button
            type="button"
            onClick={resetStateAndClose}
            className="border border-white/10 px-4 py-2 text-sm text-zinc-200 hover:border-orange-500 hover:text-orange-300"
          >
            Close
          </button>
        </div>

        {error ? (
          <div className="mb-4 border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        <section className="border border-white/10 p-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <label className="space-y-2">
              <span className="text-sm text-zinc-300">Choose Excel File</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) =>
                  void handleFileChange(e.target.files?.[0] ?? null)
                }
                className="w-full border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none file:mr-3 file:border-0 file:bg-orange-500 file:px-3 file:py-2 file:text-black"
              />
            </label>

            <button
              type="button"
              onClick={handleImport}
              disabled={saving || parsing || validRows.length === 0}
              className="border border-orange-500 bg-orange-500 px-5 py-3 text-sm font-medium text-black hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Importing..." : "Import Valid Rows"}
            </button>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="border border-white/10 bg-zinc-950 p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                Selected File
              </p>
              <p className="mt-2 text-sm text-white">
                {fileName || "No file selected"}
              </p>
            </div>

            <div className="border border-white/10 bg-zinc-950 p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                Valid Rows
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {validRows.length}
              </p>
            </div>

            <div className="border border-white/10 bg-zinc-950 p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                Invalid Rows
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {invalidRows.length}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="border border-white/10 p-4">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-white">
                Preview of valid rows
              </h3>
              <p className="mt-1 text-sm text-zinc-400">
                Showing the first few rows that passed validation.
              </p>
            </div>

            {!previewRows.length ? (
              <div className="text-sm text-zinc-500">
                No valid rows available yet.
              </div>
            ) : (
              <div className="overflow-x-auto border border-white/10 bg-zinc-950">
                <table className="min-w-full text-left text-sm text-white">
                  <thead className="border-b border-white/10 bg-white/5">
                    <tr>
                      <th className="px-4 py-3 font-medium text-zinc-300">
                        Asset
                      </th>
                      <th className="px-4 py-3 font-medium text-zinc-300">
                        Serial
                      </th>
                      <th className="px-4 py-3 font-medium text-zinc-300">
                        Category
                      </th>
                      <th className="px-4 py-3 font-medium text-zinc-300">
                        Location
                      </th>
                      <th className="px-4 py-3 font-medium text-zinc-300">
                        Batch
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, index) => (
                      <tr
                        key={`${row.asset_name}-${row.serial_number}-${index}`}
                        className="border-b border-white/5"
                      >
                        <td className="px-4 py-3">{row.asset_name}</td>
                        <td className="px-4 py-3">{row.serial_number}</td>
                        <td className="px-4 py-3">
                          {row.category_name || "—"}
                        </td>
                        <td className="px-4 py-3">
                          {row.location_name || "—"}
                        </td>
                        <td className="px-4 py-3">
                          {row.purchase_batch_name || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <section className="border border-white/10 p-4">
              <h3 className="text-base font-semibold text-white">
                Detected Headers
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {headers.length ? (
                  headers.map((header) => (
                    <span
                      key={header}
                      className="border border-white/10 bg-zinc-950 px-3 py-1 text-xs text-zinc-300"
                    >
                      {header}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-zinc-500">
                    Upload a file to inspect its headers.
                  </p>
                )}
              </div>
            </section>

            <section className="border border-white/10 p-4">
              <h3 className="text-base font-semibold text-white">
                Invalid rows
              </h3>

              {!invalidRows.length ? (
                <p className="mt-3 text-sm text-zinc-500">
                  No invalid rows detected yet.
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  {invalidRows.slice(0, 8).map((item) => (
                    <div
                      key={`${item.rowNumber}-${item.errors.join("-")}`}
                      className="border border-red-500/20 bg-red-500/10 p-3"
                    >
                      <p className="text-sm font-medium text-red-300">
                        Row {item.rowNumber}
                      </p>
                      <ul className="mt-2 space-y-1 text-sm text-red-200">
                        {item.errors.map((message) => (
                          <li key={message}>• {message}</li>
                        ))}
                      </ul>
                      {item.warnings.length > 0 && (
                        <ul className="mt-2 space-y-1 text-sm text-amber-200">
                          {item.warnings.map((message) => (
                            <li key={message}>⚠ {message}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="border border-white/10 p-4">
              <h3 className="text-base font-semibold text-white">
                Expected columns
              </h3>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Minimum required columns are{" "}
                <span className="text-white">asset_name</span> and{" "}
                <span className="text-white">serial_number</span>. Optional
                columns include category_name, location_name,
                purchase_batch_name, purchase_price, purchase_date,
                warranty_expiry_date, insured, insurance_provider, notes, and
                others.
              </p>
            </section>
          </div>
        </section>

        {parsing ? (
          <div className="mt-6 text-sm text-zinc-400">Reading file...</div>
        ) : null}
      </div>
    </div>
  );
}
