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
import { Banner, Button, DataTable, FieldLabel, Icon, Modal, StatusPill, TextField } from "@/components/ds";

const BATCH_SIZE = 10;

type RowResult =
  | { ok: true; registrationCode: string | null; bibNumber: string | null }
  | { ok: false; error: string };

// Dense (28px) Dock input for the preview grid; border/background come from cellTone().
const cellInputClass =
  "h-7 w-full min-w-[110px] rounded-4 border px-2 text-12 text-ink outline-hidden placeholder:text-ink-muted focus:border-accent";
const cellTone = (hasError: boolean) => (hasError ? "border-[#D92D20] bg-tint-red" : "border-line bg-white");

const thClass =
  "bg-surface-tertiary px-3 py-2.5 text-left text-12 font-normal text-ink-tertiary shadow-[inset_0_-1px_0_#E5E7EB]";

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

  // The old dialog only closed from its explicit Close/Done buttons, so a stray
  // overlay click or Esc can't throw away an edited preview grid: hideClose,
  // and Close lives in the footer on every step.
  const closeButton = (
    <Button type="button" size="sm" onClick={closeModal}>
      Close
    </Button>
  );

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Icon name="upload" size={16} />
        Bulk Upload
      </Button>

      <Modal
        open={open}
        onClose={closeModal}
        hideClose
        icon="upload"
        title="Bulk Upload Registrations"
        subtitle={eventName}
        width={1152}
        footer={
          <>
            {step === "upload" && closeButton}
            {step === "importing" && closeButton}
            {step === "preview" && (
              <>
                {closeButton}
                <Button type="button" size="sm" onClick={() => setStep("upload")}>
                  Back
                </Button>
                <Button type="button" size="sm" variant="dark" onClick={confirmUpload} disabled={!allValid}>
                  Confirm Upload ({rows.length})
                </Button>
              </>
            )}
            {step === "done" && (
              <Button type="button" size="sm" variant="dark" onClick={closeModal}>
                Done
              </Button>
            )}
          </>
        }
      >
        <div className="pt-4">
          {step === "upload" && (
            <div className="space-y-5">
              <p className="text-14 text-ink-secondary">
                For registrations collected offline (cash/UPI at the venue, paper forms, etc). Each row becomes
                its own registration — BIB numbers are allotted and the registration WhatsApp confirmation is
                sent automatically, exactly like an online payment.
              </p>
              <Button type="button" variant="dark" onClick={downloadTemplate}>
                <Icon name="download" size={16} />
                Download Template (.xlsx)
              </Button>
              <div>
                <TextField
                  id="bulk-default-poc"
                  label="POC name — the person collecting the money for this group"
                  className="max-w-md"
                  type="text"
                  value={defaultPoc}
                  onChange={(e) => setDefaultPoc(e.target.value)}
                  placeholder="e.g. Ramesh Sahu (Raipur Runners)"
                  maxLength={120}
                />
                <p className="mt-1.5 text-12 text-ink-muted">
                  Filled into every row whose &quot;POC Name&quot; column is blank. Rows that already name a POC keep
                  theirs, so one sheet can hold several groups. Every row needs a POC before you can confirm.
                </p>
              </div>
              <div>
                <FieldLabel label="Upload filled template (.csv or .xlsx)" htmlFor="bulk-file" />
                <input
                  id="bulk-file"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFile(file);
                  }}
                  className="block w-full text-14 text-ink-secondary file:mr-3 file:h-9 file:cursor-pointer file:rounded-6 file:border file:border-solid file:border-dark file:bg-white file:px-2.5 file:text-14 file:font-medium file:text-dark hover:file:bg-surface-secondary"
                />
              </div>
              {parseError && <Banner tone="danger">{parseError}</Banner>}
              <p className="text-12 text-ink-muted">
                Category names must match exactly — see the &quot;Categories (reference)&quot; sheet in the
                template. Competitive categories require the Aadhar/Bank/IFSC columns.
              </p>
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="flex flex-wrap items-center gap-2 text-14 text-ink">
                  {rows.length} row{rows.length === 1 ? "" : "s"} —{" "}
                  {allValid ? (
                    <StatusPill tone="active">all valid, ready to import</StatusPill>
                  ) : (
                    <StatusPill tone="warning">
                      {invalidCount} row{invalidCount === 1 ? "" : "s"} need fixing before you can confirm
                    </StatusPill>
                  )}
                </p>
                <button
                  type="button"
                  onClick={reset}
                  className="flex items-center gap-1 text-12 font-medium text-link underline decoration-dashed underline-offset-4"
                >
                  <Icon name="undo" size={14} />
                  Start over
                </button>
              </div>

              <form
                className="flex flex-wrap items-center gap-2 rounded-8 bg-surface-filter px-4 py-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  applyPocToAll(bulkPoc);
                }}
              >
                <label htmlFor="bulk-apply-poc" className="text-12 font-medium text-ink-secondary">
                  Set POC for all rows:
                </label>
                <div className="w-56">
                  <input
                    id="bulk-apply-poc"
                    type="text"
                    value={bulkPoc}
                    onChange={(e) => setBulkPoc(e.target.value)}
                    placeholder="POC name"
                    maxLength={120}
                    className={`${cellInputClass} ${cellTone(false)}`}
                  />
                </div>
                <Button type="submit" size="sm" disabled={!bulkPoc.trim()}>
                  Apply to all {rows.length}
                </Button>
              </form>

              <div className="max-h-[55vh] overflow-auto rounded-8 border border-line">
                <table className="w-full min-w-[1620px] border-collapse text-12">
                  <thead className="sticky top-0 z-10">
                    <tr>
                      <th className={thClass}>#</th>
                      {BULK_TEMPLATE_COLUMNS.map((c) => (
                        <th key={c.key} className={`${thClass} whitespace-nowrap`}>
                          {c.label}
                        </th>
                      ))}
                      <th className={thClass}>
                        <span className="sr-only">Remove</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => {
                      const errs = rowErrors[i];
                      const errEntries = Object.entries(errs);
                      return (
                        <Fragment key={i}>
                          <tr className="border-t border-alpha-4 align-top hover:bg-surface-secondary">
                            <td className="px-3 py-2 leading-7 text-ink-muted">{i + 1}</td>
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
                                className="flex h-7 w-7 items-center justify-center rounded-4 text-ink-muted hover:bg-tint-red hover:text-[#D92D20]"
                                title="Remove row"
                                aria-label="Remove row"
                              >
                                <Icon name="close" size={14} />
                              </button>
                            </td>
                          </tr>
                          {errEntries.length > 0 && (
                            <tr>
                              <td colSpan={BULK_TEMPLATE_COLUMNS.length + 2} className="px-2 pb-2">
                                <div className="rounded-6 bg-tint-red px-3 py-2 text-on-tint-red">
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
              <p className="text-14 text-ink">
                Importing {progress} of {rows.length}…
              </p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-tertiary">
                <div
                  className="h-full rounded-full bg-dark transition-all"
                  style={{ width: `${(progress / rows.length) * 100}%` }}
                />
              </div>
            </div>
          )}

          {step === "done" && <ImportSummary rows={rows} results={results} />}
        </div>
      </Modal>
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
  const cls = `${cellInputClass} ${cellTone(hasError)}`;

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
      <p className="flex flex-wrap items-center gap-2">
        <StatusPill tone="active">{succeeded} created</StatusPill>
        {failed.length > 0 && <StatusPill tone="expired">{failed.length} failed</StatusPill>}
      </p>
      {failed.length > 0 && (
        <DataTable
          minWidth={0}
          maxHeight={360}
          rows={failed.map((f, i) => ({ ...f, i }))}
          rowKey={(r) => String(r.i)}
          columns={[
            { key: "name", header: "Name", render: (r) => r.row.fullName },
            { key: "category", header: "Category", render: (r) => r.row.category },
            {
              key: "error",
              header: "Error",
              render: (r) => <span className="text-[#D92D20]">{r.result.error}</span>,
            },
          ]}
        />
      )}
    </div>
  );
}
