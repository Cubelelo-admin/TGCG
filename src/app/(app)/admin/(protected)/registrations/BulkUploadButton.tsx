"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import {
  BULK_TEMPLATE_COLUMNS,
  EMPTY_BULK_ROW,
  parseDateOfBirth,
  validateBulkRow,
  type BulkCategoryInfo,
  type BulkRowFields,
} from "@/lib/bulk-registration-schema";
import { GENDERS, TSHIRT_SIZES } from "@/lib/registration-schema";

const BATCH_SIZE = 10;

type RowResult =
  | { ok: true; registrationCode: string | null; bibNumber: string | null }
  | { ok: false; error: string };

const inputClass =
  "w-full min-w-[110px] rounded border border-white/10 bg-white/[0.04] px-2 py-1 text-xs focus:border-emerald-400 focus:outline-none";
const errorInputClass = "border-red-500/70 bg-red-500/10";

export default function BulkUploadButton({
  eventId,
  eventName,
  categories,
}: {
  eventId: string;
  eventName: string;
  categories: (BulkCategoryInfo & { price_inr: number })[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "done">("upload");
  const [rows, setRows] = useState<BulkRowFields[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<Record<number, RowResult>>({});
  // Group POC — the person collecting the money for this upload's
  // registrations. Fills every row whose "POC Name" cell is blank.
  const [defaultPoc, setDefaultPoc] = useState("");
  const [bulkPoc, setBulkPoc] = useState("");

  function reset() {
    setStep("upload");
    setRows([]);
    setParseError(null);
    setProgress(0);
    setResults({});
    setDefaultPoc("");
    setBulkPoc("");
  }

  function closeModal() {
    setOpen(false);
    reset();
    if (step === "done") router.refresh();
  }

  function downloadTemplate() {
    const headers = BULK_TEMPLATE_COLUMNS.map((c) => c.label);
    const exampleRow = BULK_TEMPLATE_COLUMNS.map((c) => {
      switch (c.key) {
        case "fullName":
          return "EXAMPLE — delete this row";
        case "category":
          return categories[0]?.name ?? "";
        case "amountInr":
          return String(categories[0]?.price_inr ?? "");
        case "pocName":
          return "Group POC name (or leave blank and fill on upload)";
        case "phone":
        case "emergencyPhone":
          return "9800000000";
        case "gender":
          return "male";
        case "city":
          return "Raipur";
        case "dateOfBirth":
          return "1995-01-31";
        case "tshirtSize":
          return "M";
        default:
          return "";
      }
    });

    const sheet = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Registrations");

    const categorySheet = XLSX.utils.aoa_to_sheet([
      ["Category Name (copy exactly)", "Requires KYC?", "Typical Price (₹)"],
      ...categories.map((c) => [c.name, c.requires_kyc ? "Yes" : "No", c.price_inr]),
    ]);
    XLSX.utils.book_append_sheet(wb, categorySheet, "Categories (reference)");

    const fileSlug = eventName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    XLSX.writeFile(wb, `${fileSlug || "tgcg"}-bulk-registration-template.xlsx`);
  }

  async function handleFile(file: File) {
    setParseError(null);
    try {
      const isCsv = file.name.toLowerCase().endsWith(".csv");
      const workbook = isCsv
        ? XLSX.read(await file.text(), { type: "string" })
        : XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });

      const labelToKey = new Map(BULK_TEMPLATE_COLUMNS.map((c) => [c.label.trim().toLowerCase(), c.key]));

      const parsedRows: BulkRowFields[] = raw
        .map((line) => {
          const row: BulkRowFields = { ...EMPTY_BULK_ROW };
          for (const [header, value] of Object.entries(line)) {
            const key = labelToKey.get(header.trim().toLowerCase());
            if (key) row[key] = String(value ?? "").trim();
          }
          // Normalize whatever date format the sheet had (DD-MM-YYYY,
          // DD/MM/YYYY, etc.) to YYYY-MM-DD right away, so the preview grid
          // shows the admin the date as it'll actually be saved — instead
          // of leaving the ambiguous raw text for them to second-guess.
          // Left as-is (and caught by validateBulkRow) if unparseable.
          row.dateOfBirth = parseDateOfBirth(row.dateOfBirth) ?? row.dateOfBirth;
          if (!row.pocName && defaultPoc.trim()) row.pocName = defaultPoc.trim();
          return row;
        })
        // Skip fully-blank rows and the sample row shipped in the template.
        .filter((row) => row.fullName && !row.fullName.toLowerCase().startsWith("example"));

      if (parsedRows.length === 0) {
        setParseError("No data rows found in that file — check it matches the template's headers.");
        return;
      }

      setRows(parsedRows);
      setStep("preview");
    } catch (err) {
      console.error("bulk upload parse failed", err);
      setParseError("Couldn't read that file. Make sure it's the .csv or .xlsx template, unmodified in header row.");
    }
  }

  function updateCell(index: number, key: keyof BulkRowFields, value: string) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  }

  function applyPocToAll(value: string) {
    const poc = value.trim();
    if (!poc) return;
    setRows((prev) => prev.map((row) => ({ ...row, pocName: poc })));
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  const rowErrors = rows.map((row) => validateBulkRow(row, categories));
  const invalidCount = rowErrors.filter((e) => Object.keys(e).length > 0).length;
  const allValid = rows.length > 0 && invalidCount === 0;

  async function confirmUpload() {
    setStep("importing");
    setProgress(0);
    const allResults: Record<number, RowResult> = {};

    for (let start = 0; start < rows.length; start += BATCH_SIZE) {
      const batch = rows.slice(start, start + BATCH_SIZE);
      try {
        const res = await fetch("/api/admin/registrations/bulk-import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId, rows: batch }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          batch.forEach((_, i) => {
            allResults[start + i] = { ok: false, error: json.error ?? "Import failed" };
          });
        } else {
          for (const r of json.results as { index: number; ok: boolean; error?: string; registrationCode?: string | null; bibNumber?: string | null }[]) {
            allResults[start + r.index] = r.ok
              ? { ok: true, registrationCode: r.registrationCode ?? null, bibNumber: r.bibNumber ?? null }
              : { ok: false, error: r.error ?? "Import failed" };
          }
        }
      } catch (err) {
        console.error("bulk import batch failed", err);
        batch.forEach((_, i) => {
          allResults[start + i] = { ok: false, error: "Network error" };
        });
      }
      setProgress(Math.min(start + batch.length, rows.length));
      setResults({ ...allResults });
    }

    setStep("done");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-white/20 px-4 py-2 text-sm font-medium hover:border-white/40"
      >
        Bulk Upload
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="flex max-h-[90vh] w-full max-w-6xl flex-col rounded-2xl border border-white/10 bg-neutral-900 text-neutral-50">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <h2 className="text-lg font-bold">
                Bulk Upload Registrations <span className="font-normal text-neutral-400">— {eventName}</span>
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full border border-white/20 px-3 py-1 text-xs hover:border-white/40"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {step === "upload" && (
                <div className="space-y-4">
                  <p className="text-sm text-neutral-300">
                    For registrations collected offline (cash/UPI at the venue, paper forms, etc). Each row becomes
                    its own registration — BIB numbers are allotted and the registration WhatsApp confirmation is
                    sent automatically, exactly like an online payment.
                  </p>
                  <button
                    type="button"
                    onClick={downloadTemplate}
                    className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-emerald-400"
                  >
                    Download Template (.xlsx)
                  </button>
                  <div>
                    <label htmlFor="bulk-default-poc" className="mb-1 block text-xs text-neutral-400">
                      POC name — the person collecting the money for this group
                    </label>
                    <input
                      id="bulk-default-poc"
                      type="text"
                      value={defaultPoc}
                      onChange={(e) => setDefaultPoc(e.target.value)}
                      placeholder="e.g. Ramesh Sahu (Raipur Runners)"
                      maxLength={120}
                      className="w-full max-w-md rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                    />
                    <p className="mt-1 text-xs text-neutral-500">
                      Filled into every row whose &quot;POC Name&quot; column is blank. Rows that already name a POC keep
                      theirs, so one sheet can hold several groups. Every row needs a POC before you can confirm.
                    </p>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-neutral-400">Upload filled template (.csv or .xlsx)</label>
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleFile(file);
                      }}
                      className="block w-full text-sm text-neutral-300 file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-neutral-50 hover:file:bg-white/20"
                    />
                  </div>
                  {parseError && <p className="text-sm text-red-400">{parseError}</p>}
                  <p className="text-xs text-neutral-500">
                    Category names must match exactly — see the &quot;Categories (reference)&quot; sheet in the
                    template. Competitive categories require the Aadhar/Bank/IFSC columns.
                  </p>
                </div>
              )}

              {step === "preview" && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm">
                      {rows.length} row{rows.length === 1 ? "" : "s"} —{" "}
                      {allValid ? (
                        <span className="text-emerald-400">all valid, ready to import</span>
                      ) : (
                        <span className="text-amber-400">
                          {invalidCount} row{invalidCount === 1 ? "" : "s"} need fixing before you can confirm
                        </span>
                      )}
                    </p>
                    <button
                      type="button"
                      onClick={reset}
                      className="text-xs font-medium underline text-neutral-400 hover:text-neutral-200"
                    >
                      Start over
                    </button>
                  </div>

                  <form
                    className="flex flex-wrap items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      applyPocToAll(bulkPoc);
                    }}
                  >
                    <label htmlFor="bulk-apply-poc" className="text-xs text-neutral-400">
                      Set POC for all rows:
                    </label>
                    <input
                      id="bulk-apply-poc"
                      type="text"
                      value={bulkPoc}
                      onChange={(e) => setBulkPoc(e.target.value)}
                      placeholder="POC name"
                      maxLength={120}
                      className="w-56 rounded border border-white/10 bg-white/[0.04] px-2 py-1 text-xs focus:border-emerald-400 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!bulkPoc.trim()}
                      className="rounded-full border border-white/20 px-3 py-1 text-xs font-medium hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Apply to all {rows.length}
                    </button>
                  </form>

                  <div className="max-h-[55vh] overflow-auto rounded-lg border border-white/10">
                    <table className="w-full min-w-[1620px] text-xs">
                      <thead className="sticky top-0 z-10 bg-neutral-900 text-left text-neutral-400">
                        <tr>
                          <th className="px-2 py-2 font-medium">#</th>
                          {BULK_TEMPLATE_COLUMNS.map((c) => (
                            <th key={c.key} className="px-2 py-2 font-medium">
                              {c.label}
                            </th>
                          ))}
                          <th className="px-2 py-2 font-medium"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, i) => {
                          const errs = rowErrors[i];
                          const errEntries = Object.entries(errs);
                          return (
                            <Fragment key={i}>
                              <tr className="border-t border-white/10 align-top">
                                <td className="px-2 py-2 text-neutral-500">{i + 1}</td>
                                {BULK_TEMPLATE_COLUMNS.map((c) => (
                                  <td key={c.key} className="px-2 py-2">
                                    <RowCell
                                      columnKey={c.key}
                                      value={row[c.key]}
                                      hasError={Boolean(errs[c.key])}
                                      categories={categories}
                                      onChange={(v) => updateCell(i, c.key, v)}
                                    />
                                  </td>
                                ))}
                                <td className="px-2 py-2">
                                  <button
                                    type="button"
                                    onClick={() => removeRow(i)}
                                    className="text-neutral-500 hover:text-red-400"
                                    title="Remove row"
                                  >
                                    ✕
                                  </button>
                                </td>
                              </tr>
                              {errEntries.length > 0 && (
                                <tr>
                                  <td colSpan={BULK_TEMPLATE_COLUMNS.length + 2} className="px-2 pb-2">
                                    <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-300">
                                      <ul className="flex flex-wrap gap-x-4 gap-y-1">
                                        {errEntries.map(([field, msg]) => (
                                          <li key={field}>
                                            <span className="font-semibold">
                                              {BULK_TEMPLATE_COLUMNS.find((c) => c.key === field)?.label ?? field}:
                                            </span>{" "}
                                            {msg}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {step === "importing" && (
                <div className="space-y-3">
                  <p className="text-sm">
                    Importing {progress} of {rows.length}…
                  </p>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full bg-emerald-500 transition-all"
                      style={{ width: `${(progress / rows.length) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {step === "done" && (
                <ImportSummary rows={rows} results={results} />
              )}
            </div>

            {step === "preview" && (
              <div className="flex justify-end gap-3 border-t border-white/10 px-5 py-4">
                <button
                  type="button"
                  onClick={() => setStep("upload")}
                  className="rounded-full border border-white/20 px-4 py-2 text-sm font-medium hover:border-white/40"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={confirmUpload}
                  disabled={!allValid}
                  className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Confirm Upload ({rows.length})
                </button>
              </div>
            )}

            {step === "done" && (
              <div className="flex justify-end gap-3 border-t border-white/10 px-5 py-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-emerald-400"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function RowCell({
  columnKey,
  value,
  hasError,
  categories,
  onChange,
}: {
  columnKey: keyof BulkRowFields;
  value: string;
  hasError: boolean;
  categories: BulkCategoryInfo[];
  onChange: (value: string) => void;
}) {
  const cls = `${inputClass} ${hasError ? errorInputClass : ""}`;

  if (columnKey === "category") {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={cls}>
        <option value="">Select…</option>
        {categories.map((c) => (
          <option key={c.id} value={c.name}>
            {c.name}
          </option>
        ))}
      </select>
    );
  }
  if (columnKey === "gender") {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={cls}>
        <option value="">—</option>
        {GENDERS.map((g) => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
      </select>
    );
  }
  if (columnKey === "tshirtSize") {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={cls}>
        <option value="">—</option>
        {TSHIRT_SIZES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    );
  }
  if (columnKey === "dateOfBirth") {
    return <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className={cls} />;
  }
  return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className={cls} />;
}

function ImportSummary({
  rows,
  results,
}: {
  rows: BulkRowFields[];
  results: Record<number, RowResult>;
}) {
  const entries = rows.map((row, i) => ({ row, result: results[i] }));
  const succeeded = entries.filter((e) => e.result?.ok).length;
  const failed = entries.filter(
    (e): e is { row: BulkRowFields; result: { ok: false; error: string } } => e.result !== undefined && !e.result.ok
  );

  return (
    <div className="space-y-3">
      <p className="text-sm">
        <span className="text-emerald-400">{succeeded} created</span>
        {failed.length > 0 && <span className="text-red-400"> · {failed.length} failed</span>}
      </p>
      {failed.length > 0 && (
        <div className="max-h-[40vh] overflow-y-auto rounded-lg border border-white/10">
          <table className="w-full text-xs">
            <thead className="bg-neutral-900 text-left text-neutral-400">
              <tr>
                <th className="px-2 py-2 font-medium">Name</th>
                <th className="px-2 py-2 font-medium">Category</th>
                <th className="px-2 py-2 font-medium">Error</th>
              </tr>
            </thead>
            <tbody>
              {failed.map(({ row, result }, i) => (
                <tr key={i} className="border-t border-white/10">
                  <td className="px-2 py-2">{row.fullName}</td>
                  <td className="px-2 py-2">{row.category}</td>
                  <td className="px-2 py-2 text-red-400">{result.error}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
