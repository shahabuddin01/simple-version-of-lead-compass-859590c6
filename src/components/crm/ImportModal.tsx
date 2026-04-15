import { useState, useMemo, useCallback } from "react";
import Papa from "papaparse";
import { Lead, PipelineStatus } from "@/types/lead";
import { normalizeIndustryName } from "@/lib/leadUtils";
import { cleanPhoneNumber } from "@/lib/phoneUtils";
import { motion } from "motion/react";
import { X, Upload, AlertTriangle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const validStatuses: PipelineStatus[] = ["New", "Contacted", "In Progress", "Closed", "Not Interested"];

const CRM_FIELDS = [
  { value: "", label: "(do not import)" },
  { value: "type", label: "TYPE" },
  { value: "company", label: "COMPANY" },
  { value: "companyEmail", label: "COMPANY EMAIL" },
  { value: "name", label: "NAME" },
  { value: "position", label: "POSITION" },
  { value: "phone", label: "WORK PHONE" },
  { value: "personalPhone1", label: "PERSONAL PHONE 1" },
  { value: "personalPhone2", label: "PERSONAL PHONE 2" },
  { value: "email", label: "WORK EMAIL" },
  { value: "personalEmail", label: "PERSONAL EMAIL 1" },
  { value: "personalEmail2", label: "PERSONAL EMAIL 2" },
  { value: "linkedin", label: "LINKEDIN" },
  { value: "facebook", label: "FACEBOOK" },
  { value: "instagram", label: "INSTAGRAM" },
  { value: "status", label: "STATUS" },
  { value: "active", label: "ACTIVE" },
  { value: "notes", label: "NOTES" },
] as const;

type CrmFieldValue = (typeof CRM_FIELDS)[number]["value"];

const AUTO_MATCH_RULES: { pattern: RegExp; field: CrmFieldValue }[] = [
  { pattern: /personal[_ ]?email[_ ]?2/i, field: "personalEmail2" },
  { pattern: /personal[_ ]?email/i, field: "personalEmail" },
  { pattern: /personal[_ ]?phone[_ ]?2|personal phone2/i, field: "personalPhone2" },
  { pattern: /personal[_ ]?phone[_ ]?1?|mobile/i, field: "personalPhone1" },
  { pattern: /company[_ ]?email/i, field: "companyEmail" },
  { pattern: /type/i, field: "type" },
  { pattern: /company/i, field: "company" },
  { pattern: /name/i, field: "name" },
  { pattern: /position|title/i, field: "position" },
  { pattern: /work[_ ]?phone|^phone$|phone[_ ]?number/i, field: "phone" },
  { pattern: /email/i, field: "email" },
  { pattern: /linkedin/i, field: "linkedin" },
  { pattern: /facebook/i, field: "facebook" },
  { pattern: /instagram/i, field: "instagram" },
  { pattern: /status/i, field: "status" },
  { pattern: /active/i, field: "active" },
  { pattern: /note/i, field: "notes" },
  { pattern: /linkedin/i, field: "linkedin" },
  { pattern: /facebook/i, field: "facebook" },
  { pattern: /instagram/i, field: "instagram" },
  { pattern: /status/i, field: "status" },
  { pattern: /active/i, field: "active" },
  { pattern: /note/i, field: "notes" },
];

function autoMatch(columnName: string): CrmFieldValue {
  const trimmed = columnName.trim();
  for (const rule of AUTO_MATCH_RULES) {
    if (rule.pattern.test(trimmed)) return rule.field;
  }
  return "";
}

function truncate(val: string, max = 40): string {
  if (!val) return "";
  return val.length > max ? val.slice(0, max) + "…" : val;
}

interface ImportModalProps {
  existingLeads: Lead[];
  onImport: (leads: Omit<Lead, "id" | "dateAdded">[], updateExisting: boolean) => void;
  onClose: () => void;
  existingTags?: string[];
  existingFolders?: string[];
  existingListSources?: string[];
}

export function ImportModal({
  existingLeads,
  onImport,
  onClose,
  existingTags = [],
  existingFolders = [],
  existingListSources = [],
}: ImportModalProps) {
  const [step, setStep] = useState<"upload" | "map">("upload");

  // Raw CSV data
  const [allRawRows, setAllRawRows] = useState<string[][]>([]);
  const [fileName, setFileName] = useState("");

  // Derived headers/rows based on ignoreFirstRow
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<number, CrmFieldValue>>({});

  // Import options
  const [ignoreFirstRow, setIgnoreFirstRow] = useState(true);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [listSource, setListSource] = useState("");
  const [folder, setFolder] = useState("default");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        const rawRows = results.data as string[][];
        if (rawRows.length < 1) {
          toast.error("CSV file is empty.");
          return;
        }
        setAllRawRows(rawRows);
        setListSource(file.name);

        // Process with ignoreFirstRow=true (default)
        processRawRows(rawRows, true);
        setStep("map");
      },
    });
  };

  const processRawRows = useCallback((rawRows: string[][], skipHeader: boolean) => {
    if (skipHeader && rawRows.length >= 2) {
      const hdrs = rawRows[0];
      const dataRows = rawRows.slice(1);
      setHeaders(hdrs);
      setRows(dataRows);

      // Auto-match based on header names
      const initialMapping: Record<number, CrmFieldValue> = {};
      const usedFields = new Set<CrmFieldValue>();
      hdrs.forEach((h, i) => {
        const matched = autoMatch(h);
        if (matched && !usedFields.has(matched)) {
          initialMapping[i] = matched;
          usedFields.add(matched);
        } else {
          initialMapping[i] = "";
        }
      });
      setMapping(initialMapping);
    } else {
      // No header row — generate Column 1, Column 2, etc.
      const colCount = rawRows[0]?.length || 0;
      const hdrs = Array.from({ length: colCount }, (_, i) => `Column ${i + 1}`);
      setHeaders(hdrs);
      setRows(rawRows);

      // No auto-match possible without headers
      const initialMapping: Record<number, CrmFieldValue> = {};
      hdrs.forEach((_, i) => { initialMapping[i] = ""; });
      setMapping(initialMapping);
    }
  }, []);

  // When ignoreFirstRow changes after file is loaded, reprocess
  const handleIgnoreFirstRowChange = useCallback((checked: boolean) => {
    setIgnoreFirstRow(checked);
    if (allRawRows.length > 0) {
      processRawRows(allRawRows, checked);
    }
  }, [allRawRows, processRawRows]);

  const setFieldForColumn = useCallback((colIdx: number, field: CrmFieldValue) => {
    setMapping((prev) => ({ ...prev, [colIdx]: field }));
  }, []);

  // Tag management
  const addTag = useCallback((tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !selectedTags.includes(trimmed)) {
      setSelectedTags((prev) => [...prev, trimmed]);
    }
    setTagInput("");
  }, [selectedTags]);

  const removeTag = useCallback((tag: string) => {
    setSelectedTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  const allAvailableTags = useMemo(() => {
    const set = new Set([...existingTags, ...selectedTags]);
    return [...set];
  }, [existingTags, selectedTags]);

  // Validation
  const nameIsMapped = Object.values(mapping).includes("name");
  const emailIsMapped = Object.values(mapping).includes("email");

  const duplicateFields = useMemo(() => {
    const counts: Record<string, number[]> = {};
    Object.entries(mapping).forEach(([idx, field]) => {
      if (field) {
        if (!counts[field]) counts[field] = [];
        counts[field].push(Number(idx));
      }
    });
    const dupes = new Set<number>();
    Object.values(counts).forEach((indices) => {
      if (indices.length > 1) indices.forEach((i) => dupes.add(i));
    });
    return dupes;
  }, [mapping]);

  const hasDuplicates = duplicateFields.size > 0;
  const canImport = nameIsMapped && !hasDuplicates;

  const samples = useMemo(() => rows.slice(0, 3), [rows]);

  const handleImport = () => {
    const fieldToCol: Partial<Record<CrmFieldValue, number>> = {};
    Object.entries(mapping).forEach(([idx, field]) => {
      if (field) fieldToCol[field] = Number(idx);
    });

    const getVal = (row: string[], field: CrmFieldValue): string => {
      const colIdx = fieldToCol[field];
      if (colIdx === undefined) return "";
      return (row[colIdx] || "").trim();
    };

    const existingEmailSet = new Set(
      existingLeads.filter((l) => l.email).map((l) => l.email.toLowerCase())
    );

    const leads: Omit<Lead, "id" | "dateAdded">[] = [];
    let skipped = 0;
    let willUpdate = 0;

    for (const row of rows) {
      const name = getVal(row, "name");
      const company = getVal(row, "company");
      if (!name || name === company) { skipped++; continue; }

      const email = getVal(row, "email");

      // Check duplicate by email
      if (email && existingEmailSet.has(email.toLowerCase())) {
        if (updateExisting) {
          willUpdate++;
        } else {
          skipped++;
          continue;
        }
      }

      const activeRaw = getVal(row, "active").toLowerCase();
      const active = activeRaw ? ["true", "yes", "1"].includes(activeRaw) : true;

      const statusRaw = getVal(row, "status");
      const status = validStatuses.includes(statusRaw as PipelineStatus)
        ? (statusRaw as PipelineStatus)
        : "New";

      leads.push({
        type: normalizeIndustryName(getVal(row, "type")),
        company: getVal(row, "company").trim(),
        companyEmail: getVal(row, "companyEmail"),
        name,
        position: getVal(row, "position"),
        phone: cleanPhoneNumber(getVal(row, "phone")),
        personalPhone1: cleanPhoneNumber(getVal(row, "personalPhone1")),
        personalPhone2: cleanPhoneNumber(getVal(row, "personalPhone2")),
        email,
        personalEmail: getVal(row, "personalEmail"),
        personalEmail2: getVal(row, "personalEmail2"),
        linkedin: getVal(row, "linkedin"),
        facebook: getVal(row, "facebook"),
        instagram: getVal(row, "instagram"),
        status,
        active,
        notes: getVal(row, "notes"),
        listSource: listSource || undefined,
        folder: folder !== "default" ? folder : undefined,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
      });
    }

    onImport(leads, updateExisting);

    if (updateExisting) {
      const newCount = leads.length - willUpdate;
      toast.success(`${newCount} leads imported, ${willUpdate} leads updated, ${skipped} skipped.`);
    } else {
      toast.success(`${leads.length} leads imported, ${skipped} skipped (already exist).`);
    }
    onClose();
  };

  const allFolderOptions = useMemo(() => {
    const set = new Set(["default", ...existingFolders]);
    if (folder && folder !== "default") set.add(folder);
    return [...set];
  }, [existingFolders, folder]);

  const allListOptions = useMemo(() => {
    const set = new Set<string>();
    existingListSources.forEach((s) => set.add(s));
    if (fileName) set.add(fileName);
    return [...set];
  }, [existingListSources, fileName]);

  const inputClasses = "w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors";
  const checkboxClasses = "h-4 w-4 rounded border-input text-primary accent-primary";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className={`rounded-lg border border-border bg-card shadow-xl ${
          step === "upload" ? "w-full max-w-lg p-6" : "w-full max-w-4xl p-6"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold tracking-tight">
            {step === "upload" ? "Import CSV" : "Match your data"}
          </h2>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step 1: Upload + Options */}
        {step === "upload" && (
          <div className="space-y-5">
            {/* File picker */}
            <label className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed border-border p-8 hover:border-primary/50 transition-colors">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {fileName ? fileName : "Click to select a CSV file"}
              </span>
              <input type="file" accept=".csv" onChange={handleFile} className="hidden" />
            </label>

            {/* Import Options — shown after file is selected */}
            {allRawRows.length > 0 && (
              <div className="space-y-4 rounded-md border border-border p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Import Options</h3>

                {/* Option 1: Ignore First Row */}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ignoreFirstRow}
                    onChange={(e) => handleIgnoreFirstRowChange(e.target.checked)}
                    className={checkboxClasses}
                  />
                  <div>
                    <span className="text-sm font-medium">Ignore First Row When Importing</span>
                    <p className="text-xs text-muted-foreground mt-0.5">Only select if CSV has a header row</p>
                  </div>
                </label>

                {/* Option 2: Update Existing */}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={updateExisting}
                    onChange={(e) => setUpdateExisting(e.target.checked)}
                    className={checkboxClasses}
                  />
                  <div>
                    <span className="text-sm font-medium">Update Prospect If Already Exists In CRM</span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {updateExisting
                        ? "If email exists, the data will be updated"
                        : "Only new emails will be added"}
                    </p>
                  </div>
                </label>

                {/* Option 3: Add To List + In Folder */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Add To List</label>
                    <select
                      value={listSource}
                      onChange={(e) => setListSource(e.target.value)}
                      className={inputClasses}
                    >
                      {allListOptions.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">In Folder</label>
                    <input
                      list="folder-options"
                      value={folder}
                      onChange={(e) => setFolder(e.target.value)}
                      className={inputClasses}
                      placeholder="default"
                    />
                    <datalist id="folder-options">
                      {allFolderOptions.map((f) => (
                        <option key={f} value={f} />
                      ))}
                    </datalist>
                  </div>
                </div>

                {/* Option 4: Add Tags */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Add Tags To All</label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {selectedTags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                      >
                        {tag}
                        <button onClick={() => removeTag(tag)} className="hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      list="tag-options"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); addTag(tagInput); }
                      }}
                      className={inputClasses}
                      placeholder="Type a tag and press Enter"
                    />
                    <datalist id="tag-options">
                      {allAvailableTags.filter((t) => !selectedTags.includes(t)).map((t) => (
                        <option key={t} value={t} />
                      ))}
                    </datalist>
                    <button
                      type="button"
                      onClick={() => addTag(tagInput)}
                      disabled={!tagInput.trim()}
                      className="shrink-0 rounded-md border border-input px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Mapping */}
        {step === "map" && (
          <div className="space-y-4">
            {/* Validation messages */}
            <div className="space-y-2">
              {!nameIsMapped && (
                <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Name field is required to import leads.
                </div>
              )}
              {!emailIsMapped && nameIsMapped && (
                <div className="flex items-center gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-700 dark:text-yellow-400">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  No email field mapped — some leads may be incomplete.
                </div>
              )}
              {hasDuplicates && (
                <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Each field can only be mapped to one column.
                </div>
              )}
            </div>

            {/* Mapping list */}
            <div className="max-h-[60vh] overflow-auto rounded-md border border-border divide-y divide-border">
              {headers.map((header, colIdx) => {
                const isDuplicate = duplicateFields.has(colIdx);
                return (
                  <div
                    key={colIdx}
                    className={`px-4 py-3 space-y-2 ${isDuplicate ? "bg-destructive/5" : ""}`}
                  >
                    <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                      <span className="text-sm font-medium truncate w-full sm:w-1/3 sm:min-w-[120px]">{header}</span>
                      <select
                        value={mapping[colIdx] || ""}
                        onChange={(e) => setFieldForColumn(colIdx, e.target.value as CrmFieldValue)}
                        className={`w-full sm:w-2/3 rounded-md border px-2 py-1.5 text-sm bg-background transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
                          isDuplicate ? "border-destructive text-destructive" : "border-input"
                        }`}
                      >
                        {CRM_FIELDS.map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    {samples.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {samples.map((row, sampleIdx) => {
                          const val = truncate(row[colIdx] || "", 30);
                          return val ? (
                            <span key={sampleIdx} className="inline-block rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground truncate max-w-[150px]">
                              {val}
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setStep("upload")}
                className="flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={!canImport}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                Import Leads ({rows.length})
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
