import { supabase } from "../../../lib/supabase/client";
import { getZimbabweDateKey, makeZimbabweLocalIso } from "../../../lib/utils/zimbabweCalendar";
import { createClient } from "../../clients/services/clientService";
import type { Board } from "../../../types/board";

type JsonRecord = Record<string, unknown>;

export type EverhourImportResult = {
  scanned: number;
  imported: number;
  duplicates: number;
  skipped: number;
  boardsCreated: number;
  tasksCreated: number;
  usersMapped: number;
  projectsMapped: number;
  estimatesUpdated: number;
  invoicesImported: number;
  unmatchedUsers: Array<{
    name: string | null;
    email: string | null;
    externalId: string | null;
    reason: string;
  }>;
  errors: string[];
};

export type TrelloBoardImportResult = {
  boardName: string;
  boardId: string | null;
  scannedLists: number;
  scannedCards: number;
  listsImported: number;
  cardsImported: number;
  duplicates: number;
  assigneesLinked: number;
  checklistsImported: number;
  checklistItemsImported: number;
  attachmentsImported: number;
  commentsImported: number;
  timeEntriesImported: number;
  totalImportedSeconds: number;
  importedTimeStatus: "not_requested" | "imported" | "no_time_data_found";
  unmatchedTimeUsers: Array<{
    sourceUserId: string | null;
    sourceUserName: string | null;
    sourceUserEmail: string | null;
    durationSeconds: number;
  }>;
  unmatchedMembers: Array<{
    trelloMemberId: string;
    name: string | null;
    username: string | null;
    reason: string;
  }>;
  errors: string[];
};

type NormalizedEverhourEntry = {
  externalId: string | null;
  userEmail: string | null;
  userName: string | null;
  userExternalId: string | null;
  projectExternalId: string | null;
  taskExternalId: string | null;
  clientName: string | null;
  projectName: string | null;
  taskName: string | null;
  description: string | null;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number;
  isBillable: boolean;
  hourlyRate: number | null;
  costAmount: number | null;
  approvalStatus: "pending" | "approved" | "rejected";
  raw: JsonRecord;
};

type NormalizedEverhourInvoice = {
  externalId: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  currency: string | null;
  subtotal: number | null;
  taxTotal: number | null;
  total: number | null;
  status: string | null;
  clientName: string | null;
  projectName: string | null;
  projectExternalId: string | null;
  fileName: string | null;
  publicUrl: string | null;
  raw: JsonRecord;
};

type NormalizedEverhourUser = {
  externalId: string;
  email: string | null;
  name: string | null;
  role: string | null;
  status: string | null;
  raw: JsonRecord;
};

type NormalizedEverhourProject = {
  externalId: string;
  name: string | null;
  status: string | null;
  budgetSeconds: number | null;
  raw: JsonRecord;
};

type NormalizedTrelloTimeEntry = {
  sourceEntryId: string | null;
  sourceCardId: string | null;
  sourceBoardId: string | null;
  sourceUserId: string | null;
  sourceUserName: string | null;
  sourceUserEmail: string | null;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  description: string | null;
  entryType: "timer" | "manual" | "imported";
  provider: string;
  raw: JsonRecord;
};

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function getString(record: JsonRecord | null, keys: string[]): string | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function getNumber(record: JsonRecord | null, keys: string[]): number | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) {
      return Number(value);
    }
  }
  return null;
}

function getFirstStringFromArray(value: unknown): string | null {
  if (!Array.isArray(value)) return null;

  for (const item of value) {
    if (typeof item === "string" && item.trim()) return item.trim();
    if (typeof item === "number" && Number.isFinite(item)) return String(item);

    const record = asRecord(item);
    const id = getString(record, ["id", "externalId", "shortLink"]);
    if (id) return id;
  }

  return null;
}

function stripTrelloPrefix(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase().startsWith("tr:") ? trimmed.slice(3) : trimmed;
}

function extractTrelloIdFromValue(value: string | null | undefined) {
  const stripped = stripTrelloPrefix(value);
  if (!stripped) return null;

  const cardUrl = stripped.match(/trello\.com\/c\/([a-zA-Z0-9]+)/);
  if (cardUrl?.[1]) return cardUrl[1];

  const boardUrl = stripped.match(/trello\.com\/b\/([a-zA-Z0-9]+)/);
  if (boardUrl?.[1]) return boardUrl[1];

  return stripped;
}

function parseDurationSeconds(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 24 * 60 * 60 ? Math.round(value / 1000) : Math.round(value);
  }

  if (typeof value !== "string") return null;

  const text = value.trim().toLowerCase();
  if (!text) return null;

  const clockMatch = text.match(/^(\d{1,3}):(\d{2})(?::(\d{2}))?$/);
  if (clockMatch) {
    return (
      Number(clockMatch[1]) * 3600 +
      Number(clockMatch[2]) * 60 +
      Number(clockMatch[3] ?? 0)
    );
  }

  const hours = text.match(/([\d.]+)\s*h/);
  const minutes = text.match(/([\d.]+)\s*m/);
  const seconds = text.match(/([\d.]+)\s*s/);
  const total =
    Number(hours?.[1] ?? 0) * 3600 +
    Number(minutes?.[1] ?? 0) * 60 +
    Number(seconds?.[1] ?? 0);

  if (total > 0) return Math.round(total);
  const numeric = Number(text);
  return Number.isFinite(numeric) ? Math.round(numeric) : null;
}

function parseDate(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function collectCandidateRecords(input: unknown): JsonRecord[] {
  const records: JsonRecord[] = [];
  const seen = new Set<JsonRecord>();

  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }

    const record = asRecord(value);
    if (!record || seen.has(record)) return;
    seen.add(record);

    const hasTimeSignal =
      getString(record, ["started_at", "startedAt", "start", "from", "date", "day"]) ||
      getString(record, ["duration", "time", "timeSpent"]) ||
      getNumber(record, ["duration_seconds", "durationSeconds", "seconds", "minutes", "hours"]);

    const hasPersonSignal =
      getString(record, ["user", "member", "userName", "memberName", "email", "userEmail"]) ||
      asRecord(record.user) ||
      asRecord(record.member);

    if (hasTimeSignal && hasPersonSignal) records.push(record);

    for (const value of Object.values(record)) {
      if (Array.isArray(value)) visit(value);
    }
  };

  visit(input);
  return records;
}

function collectInvoiceRecords(input: unknown): JsonRecord[] {
  const records: JsonRecord[] = [];
  const seen = new Set<JsonRecord>();

  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }

    const record = asRecord(value);
    if (!record || seen.has(record)) return;
    seen.add(record);

    const text = JSON.stringify(record).toLowerCase();
    const hasInvoiceSignal =
      getString(record, ["invoice_number", "invoiceNumber", "number", "invoiceNo"]) ||
      text.includes("invoice");
    const hasMoneySignal =
      getNumber(record, ["total", "amount", "subtotal", "tax_total", "taxTotal"]) !== null;

    if (hasInvoiceSignal && hasMoneySignal) records.push(record);

    for (const nested of Object.values(record)) {
      if (Array.isArray(nested) || asRecord(nested)) visit(nested);
    }
  };

  visit(input);
  return records;
}

function normalizeInvoice(record: JsonRecord): NormalizedEverhourInvoice | null {
  const project = asRecord(record.project);
  const client = asRecord(record.client) ?? asRecord(record.customer);
  const file = asRecord(record.file) ?? asRecord(record.pdf) ?? asRecord(record.attachment);
  const invoiceNumber = getString(record, ["invoice_number", "invoiceNumber", "number", "invoiceNo"]);
  const total = getNumber(record, ["total", "amount", "totalAmount", "grandTotal"]);

  if (!invoiceNumber && !total) return null;

  return {
    externalId: getString(record, ["id", "invoiceId", "externalId"]),
    invoiceNumber,
    invoiceDate: parseDate(getString(record, ["invoice_date", "invoiceDate", "date", "issuedAt"])),
    periodStart: parseDate(getString(record, ["period_start", "periodStart", "from", "startDate"])),
    periodEnd: parseDate(getString(record, ["period_end", "periodEnd", "to", "endDate"])),
    currency: getString(record, ["currency"]) ?? "USD",
    subtotal: getNumber(record, ["subtotal", "subTotal"]),
    taxTotal: getNumber(record, ["tax_total", "taxTotal", "tax"]),
    total,
    status: getString(record, ["status"]) ?? "imported",
    clientName: getString(client, ["name"]) ?? getString(record, ["client", "clientName", "customer", "customerName"]),
    projectName: getString(project, ["name"]) ?? getString(record, ["project", "projectName", "board", "boardName"]),
    projectExternalId:
      getString(project, ["id", "externalId", "shortLink"]) ??
      extractTrelloIdFromValue(getString(record, ["projectId", "projectExternalId", "boardId", "boardExternalId", "boardUrl", "projectUrl"])),
    fileName: getString(file, ["name", "fileName"]) ?? getString(record, ["fileName"]),
    publicUrl:
      getString(file, ["url", "publicUrl", "downloadUrl"]) ??
      getString(record, ["url", "pdfUrl", "publicUrl", "downloadUrl"]),
    raw: record,
  };
}

function collectEverhourUsers(input: unknown): NormalizedEverhourUser[] {
  return asArray(input)
    .map(asRecord)
    .filter((record): record is JsonRecord => Boolean(record))
    .map((record) => {
      const externalId = getString(record, ["id"]);
      if (!externalId) return null;
      return {
        externalId,
        email: getString(record, ["email"]),
        name: getString(record, ["name", "fullName", "full_name"]),
        role: getString(record, ["role"]),
        status: getString(record, ["status"]),
        raw: record,
      };
    })
    .filter((user): user is NormalizedEverhourUser => Boolean(user));
}

function collectEverhourProjects(input: unknown): NormalizedEverhourProject[] {
  return asArray(input)
    .map(asRecord)
    .filter((record): record is JsonRecord => Boolean(record))
    .map((record) => {
      const externalId = getString(record, ["id"]);
      if (!externalId) return null;
      const budget = asRecord(record.budget);
      return {
        externalId,
        name: getString(record, ["name"]),
        status: getString(record, ["status"]),
        budgetSeconds: getNumber(budget, ["budget"]) ?? null,
        raw: record,
      };
    })
    .filter((project): project is NormalizedEverhourProject => Boolean(project));
}

function collectEverhourEstimateRecords(input: unknown): JsonRecord[] {
  return asArray(input)
    .map(asRecord)
    .filter((record): record is JsonRecord => {
      if (!record) return false;
      const task = asRecord(record.task);
      const estimate = asRecord(record.estimate);
      return Boolean(task && getString(task, ["id"]) && estimate && getNumber(estimate, ["total"]));
    });
}

function normalizeEntry(record: JsonRecord): NormalizedEverhourEntry | null {
  const user = asRecord(record.user) ?? asRecord(record.member) ?? asRecord(record.employee);
  const task = asRecord(record.task);
  const project = asRecord(record.project);
  const client = asRecord(record.client);

  const startedAt =
    parseDate(getString(record, ["started_at", "startedAt", "start", "from", "timeFrom"])) ??
    (getString(record, ["date", "day"])
      ? makeZimbabweLocalIso(getString(record, ["date", "day"])!)
      : null);

  let endedAt = parseDate(getString(record, ["ended_at", "endedAt", "end", "to", "timeTo"]));

  const durationSeconds =
    getNumber(record, ["duration_seconds", "durationSeconds", "seconds"]) ??
    ((getNumber(record, ["duration_minutes", "durationMinutes", "minutes"]) ?? 0) * 60 || null) ??
    ((getNumber(record, ["duration_hours", "durationHours", "hours"]) ?? 0) * 3600 || null) ??
    parseDurationSeconds(record.duration) ??
    parseDurationSeconds(record.time) ??
    parseDurationSeconds(record.timeSpent);

  if (!startedAt || !durationSeconds || durationSeconds <= 0) return null;

  if (!endedAt) {
    endedAt = new Date(new Date(startedAt).getTime() + durationSeconds * 1000).toISOString();
  }

  const status = getString(record, ["approval_status", "approvalStatus", "status"]);

  return {
    externalId: getString(record, ["id", "timeId", "entryId", "externalId"]),
    userEmail: getString(user, ["email"]) ?? getString(record, ["email", "userEmail", "memberEmail"]),
    userName:
      getString(user, ["name", "fullName", "full_name"]) ??
      getString(record, ["userName", "memberName", "employeeName"]),
    userExternalId:
      getString(user, ["id", "externalId"]) ??
      getString(record, ["user", "userId", "memberId"]),
    projectExternalId:
      getString(project, ["id", "externalId", "shortLink"]) ??
      extractTrelloIdFromValue(getString(record, ["projectId", "projectExternalId", "boardId", "boardExternalId", "boardUrl", "projectUrl"])) ??
      getFirstStringFromArray(task?.projects),
    taskExternalId:
      getString(task, ["id", "externalId", "shortLink"]) ??
      extractTrelloIdFromValue(getString(record, ["taskId", "taskExternalId", "issueId", "taskUrl", "url"])),
    clientName:
      getString(client, ["name"]) ??
      getString(record, ["client", "clientName", "customer", "customerName"]),
    projectName:
      getString(project, ["name"]) ??
      getString(record, ["project", "projectName", "board", "boardName"]),
    taskName:
      getString(task, ["name", "title"]) ??
      getString(record, ["task", "taskName", "taskTitle", "issue", "issueTitle"]),
    description: getString(record, ["notes", "note", "comment", "description"]),
    startedAt,
    endedAt,
    durationSeconds,
    isBillable: Boolean(record.billable ?? record.is_billable ?? record.isBillable),
    hourlyRate: getNumber(record, ["hourlyRate", "rate", "hourly_rate_snapshot"]),
    costAmount: getNumber(record, ["cost", "amount", "cost_amount"]),
    approvalStatus: status === "approved" || status === "rejected" ? status : "pending",
    raw: record,
  };
}

function normalizeKey(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function getBoolean(record: JsonRecord | null, keys: string[]): boolean | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") return value;
  }
  return null;
}

function normalizeTrelloLabel(label: JsonRecord) {
  return {
    id: getString(label, ["id"]) ?? crypto.randomUUID(),
    name: getString(label, ["name"]) ?? "",
    color: getString(label, ["color"]) ?? "orange",
  };
}

function statusFromTrelloListName(name: string | null | undefined) {
  const normalized = normalizeKey(name);
  if (normalized.includes("done") || normalized.includes("complete")) {
    return "done";
  }
  if (normalized.includes("review") || normalized.includes("approval")) {
    return "review";
  }
  if (normalized.includes("progress") || normalized.includes("doing")) {
    return "in_progress";
  }
  if (normalized.includes("backlog")) return "backlog";
  return "todo";
}

function normalizeColumnMatchKey(name: string | null | undefined) {
  return normalizeKey(name).replace(/[^a-z0-9]/g, "");
}

function defaultStatusForTrelloListName(name: string | null | undefined) {
  const normalized = normalizeColumnMatchKey(name);
  if (["todo", "to-do", "to_do"].includes(normalized) || normalized === "todo") return "todo";
  if (["done", "complete", "completed"].includes(normalized)) return "done";
  if (["doing", "inprogress", "progress"].includes(normalized)) return "in_progress";
  if (["backlog", "ideas"].includes(normalized)) return "backlog";
  return null;
}

function deterministicHash(parts: Array<string | number | null | undefined>) {
  const input = parts.map((part) => String(part ?? "")).join("|");
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `h${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function parsePluginValue(record: JsonRecord): unknown {
  const value = record.value ?? record.data;
  if (typeof value !== "string") return value ?? record;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function collectTrelloTimeCandidateRecords(input: unknown): JsonRecord[] {
  const candidates: JsonRecord[] = [];
  const seen = new Set<JsonRecord>();

  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }

    if (typeof value === "string") return;

    const record = asRecord(value);
    if (!record || seen.has(record)) return;
    seen.add(record);

    const hasDuration =
      getNumber(record, ["duration_seconds", "durationSeconds", "seconds", "timeSpentSeconds", "totalSeconds"]) ??
      getNumber(record, ["duration_minutes", "durationMinutes", "minutes", "timeSpentMinutes", "totalMinutes"]) ??
      getNumber(record, ["duration_hours", "durationHours", "hours", "timeSpentHours", "totalHours"]) ??
      parseDurationSeconds(record.duration) ??
      parseDurationSeconds(record.time) ??
      parseDurationSeconds(record.timeSpent) ??
      parseDurationSeconds(record.total);

    const hasTimeProvider =
      /\b(everhour|planyway|timecamp|harvest)\b/i.test(
        JSON.stringify(record).slice(0, 3000),
      );
    const hasExplicitTimestamp = Boolean(
      getString(record, ["startedAt", "started_at", "start", "from", "date", "day", "createdAt"]),
    );

    if (hasDuration && hasTimeProvider && hasExplicitTimestamp) {
      candidates.push(record);
    }

    for (const nested of Object.values(record)) {
      if (Array.isArray(nested) || asRecord(nested)) visit(nested);
    }
  };

  visit(input);
  return candidates;
}

function normalizeTrelloTimeEntry(params: {
  record: JsonRecord;
  cardId: string | null;
  boardId: string | null;
  memberLookup: Map<string, JsonRecord>;
}): NormalizedTrelloTimeEntry | null {
  const record = params.record;
  const user =
    asRecord(record.user) ??
    asRecord(record.member) ??
    asRecord(record.memberCreator) ??
    asRecord(record.author) ??
    null;
  const sourceUserId =
    getString(user, ["id", "externalId", "idMember"]) ??
    getString(record, ["userId", "memberId", "idMember", "authorId"]);
  const memberRecord = sourceUserId ? params.memberLookup.get(sourceUserId) ?? null : null;
  const sourceUserName =
    getString(user, ["fullName", "name", "username", "displayName"]) ??
    getString(memberRecord, ["fullName", "username", "name"]) ??
    getString(record, ["userName", "memberName", "authorName"]);
  const sourceUserEmail =
    getString(user, ["email"]) ??
    getString(memberRecord, ["email"]) ??
    getString(record, ["email", "userEmail", "memberEmail"]);

  const durationSeconds =
    getNumber(record, ["duration_seconds", "durationSeconds", "seconds", "timeSpentSeconds", "totalSeconds"]) ??
    ((getNumber(record, ["duration_minutes", "durationMinutes", "minutes", "timeSpentMinutes", "totalMinutes"]) ?? 0) * 60 || null) ??
    ((getNumber(record, ["duration_hours", "durationHours", "hours", "timeSpentHours", "totalHours"]) ?? 0) * 3600 || null) ??
    parseDurationSeconds(record.duration) ??
    parseDurationSeconds(record.time) ??
    parseDurationSeconds(record.timeSpent) ??
    parseDurationSeconds(record.total);

  if (!durationSeconds || durationSeconds <= 0) return null;

  const startedAt = parseDate(
    getString(record, ["started_at", "startedAt", "start", "from", "createdAt", "date", "day"]),
  );
  if (!startedAt) return null;

  const endedAt =
    parseDate(getString(record, ["ended_at", "endedAt", "end", "to"])) ??
    new Date(new Date(startedAt).getTime() + durationSeconds * 1000).toISOString();
  const sourceEntryId =
    getString(record, ["id", "entryId", "timeId", "externalId"]) ??
    deterministicHash([
      params.boardId,
      params.cardId,
      sourceUserId,
      sourceUserName,
      startedAt,
      durationSeconds,
      JSON.stringify(record).slice(0, 500),
    ]);
  const providerText = JSON.stringify(record).toLowerCase();
  const provider = providerText.includes("everhour")
    ? "everhour"
    : providerText.includes("planyway")
      ? "planyway"
      : providerText.includes("timecamp")
        ? "timecamp"
        : providerText.includes("harvest")
          ? "harvest"
          : "trello";
  const typeText = normalizeKey(getString(record, ["type", "entryType", "source"]));

  return {
    sourceEntryId,
    sourceCardId: params.cardId,
    sourceBoardId: params.boardId,
    sourceUserId,
    sourceUserName,
    sourceUserEmail,
    startedAt,
    endedAt,
    durationSeconds,
    description:
      getString(record, ["description", "notes", "note", "comment", "text"]) ??
      `Imported ${provider} time`,
    entryType: typeText.includes("timer") ? "timer" : typeText.includes("manual") ? "manual" : "imported",
    provider,
    raw: record,
  };
}

async function createImportBatch(params: {
  organizationId: string;
  source: string;
  importType: string;
  fileName?: string | null;
  importedBy: string;
}) {
  const { data, error } = await supabase
    .from("external_import_batches")
    .insert({
      organization_id: params.organizationId,
      source: params.source,
      import_type: params.importType,
      file_name: params.fileName ?? null,
      status: "running",
      imported_by: params.importedBy,
    })
    .select("id")
    .single();

  if (error) {
    console.warn("IMPORT BATCH CREATE SKIPPED:", error.message);
    return null;
  }

  return data.id as string;
}

async function finishImportBatch(params: {
  batchId: string | null;
  status: "completed" | "failed";
  summary: Record<string, unknown>;
  errorMessage?: string | null;
}) {
  if (!params.batchId) return;

  const { error } = await supabase
    .from("external_import_batches")
    .update({
      status: params.status,
      summary: params.summary,
      error_message: params.errorMessage ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", params.batchId);

  if (error) {
    console.warn("IMPORT BATCH UPDATE SKIPPED:", error.message);
  }
}

async function getMapping(params: {
  organizationId: string;
  source: string;
  externalType: string;
  externalId: string | null;
}) {
  if (!params.externalId) return null;

  const { data, error } = await supabase
    .from("external_import_mappings")
    .select("internal_id, internal_table, metadata")
    .eq("organization_id", params.organizationId)
    .eq("source", params.source)
    .eq("external_type", params.externalType)
    .eq("external_id", params.externalId)
    .maybeSingle();

  if (error) {
    console.warn("IMPORT MAPPING LOOKUP SKIPPED:", error.message);
    return null;
  }

  return data as {
    internal_id: string | null;
    internal_table: string;
    metadata: Record<string, unknown> | null;
  } | null;
}

async function upsertMapping(params: {
  organizationId: string;
  source: string;
  externalType: string;
  externalId: string | null;
  internalTable: string;
  internalId: string | null;
  importBatchId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  if (!params.externalId) return;

  const { error } = await supabase
    .from("external_import_mappings")
    .upsert(
      {
        organization_id: params.organizationId,
        source: params.source,
        external_type: params.externalType,
        external_id: params.externalId,
        internal_table: params.internalTable,
        internal_id: params.internalId,
        import_batch_id: params.importBatchId ?? null,
        metadata: params.metadata ?? {},
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "organization_id,source,external_type,external_id",
      },
    );

  if (error) {
    console.warn("IMPORT MAPPING UPSERT SKIPPED:", error.message);
  }
}

async function getOrCreateBoard(params: {
  organizationId: string;
  name: string | null;
  boardMap: Map<string, Board>;
}) {
  const { organizationId, name, boardMap } = params;
  const cleanName = name?.trim();
  if (!cleanName) return { boardId: null, created: false };

  const key = normalizeKey(cleanName);
  const existing = boardMap.get(key);
  if (existing) return { boardId: existing.id, created: false };

  const board = await createClient({
    organizationId,
    name: cleanName,
    industry: "Everhour Import",
    notes: "Created during Everhour JSON import.",
    boardType: "client",
  });

  boardMap.set(key, board as Board);
  return { boardId: board.id, created: true };
}

async function getOrCreateTask(params: {
  organizationId: string;
  boardId: string | null;
  title: string | null;
  taskMap: Map<string, string>;
}) {
  const { organizationId, boardId, title, taskMap } = params;
  const cleanTitle = title?.trim();
  if (!cleanTitle) return { taskId: null, created: false };

  const key = `${boardId ?? "none"}::${normalizeKey(cleanTitle)}`;
  const existing = taskMap.get(key);
  if (existing) return { taskId: existing, created: false };

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      organization_id: organizationId,
      client_id: boardId,
      title: cleanTitle,
      description: "Imported from Everhour JSON export.",
      status: "todo",
      priority: "medium",
      position: 0,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  taskMap.set(key, data.id as string);
  return { taskId: data.id as string, created: true };
}

async function syncImportedTaskTimeCache(params: {
  organizationId: string;
  taskId: string;
}) {
  const { data, error } = await supabase
    .from("time_entries")
    .select("duration_seconds")
    .eq("organization_id", params.organizationId)
    .eq("task_id", params.taskId);

  if (error) return;

  const total = (data ?? []).reduce(
    (sum, row) => sum + Number(row.duration_seconds ?? 0),
    0,
  );

  await supabase
    .from("tasks")
    .update({ tracked_seconds_cache: total })
    .eq("organization_id", params.organizationId)
    .eq("id", params.taskId);
}

async function resolveMappedTrelloBoard(params: {
  organizationId: string;
  externalId: string | null;
}) {
  const trelloId = stripTrelloPrefix(params.externalId);
  if (!trelloId) return null;

  const mapped =
    await getMapping({
      organizationId: params.organizationId,
      source: "trello",
      externalType: "board_short_link",
      externalId: trelloId,
    }) ??
    await getMapping({
      organizationId: params.organizationId,
      source: "trello",
      externalType: "board",
      externalId: trelloId,
    });

  return mapped?.internal_id ?? null;
}

async function resolveMappedTrelloTask(params: {
  organizationId: string;
  externalId: string | null;
  taskMap: Map<string, string>;
}) {
  const trelloId = stripTrelloPrefix(params.externalId);
  if (!trelloId) return null;

  const mapped =
    await getMapping({
      organizationId: params.organizationId,
      source: "trello",
      externalType: "card_short_link",
      externalId: trelloId,
    }) ??
    await getMapping({
      organizationId: params.organizationId,
      source: "trello",
      externalType: "card",
      externalId: trelloId,
    });

  if (!mapped?.internal_id) return null;

  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, client_id")
    .eq("id", mapped.internal_id)
    .eq("organization_id", params.organizationId)
    .maybeSingle();

  if (error || !data?.id) return null;

  params.taskMap.set(
    `${data.client_id ?? "none"}::${normalizeKey(data.title)}`,
    data.id as string,
  );

  return {
    taskId: data.id as string,
    boardId: (data.client_id as string | null) ?? null,
  };
}

function resolveExactBoardByName(params: {
  name: string | null;
  boardMap: Map<string, Board>;
}) {
  const key = normalizeKey(params.name);
  if (!key) return null;
  return params.boardMap.get(key)?.id ?? null;
}

function resolveExactTaskByTitle(params: {
  boardId: string | null;
  title: string | null;
  taskMap: Map<string, string>;
}) {
  const cleanTitle = params.title?.trim();
  if (!cleanTitle) return null;
  return params.taskMap.get(`${params.boardId ?? "none"}::${normalizeKey(cleanTitle)}`) ?? null;
}

function parseEstimateSeconds(entry: NormalizedEverhourEntry) {
  const raw = entry.raw;
  return (
    getNumber(raw, ["estimated_seconds", "estimatedSeconds", "estimateSeconds", "budgetSeconds"]) ??
    ((getNumber(raw, ["estimated_minutes", "estimatedMinutes", "estimateMinutes", "budgetMinutes"]) ?? 0) * 60 || null) ??
    ((getNumber(raw, ["estimated_hours", "estimatedHours", "estimateHours", "budgetHours"]) ?? 0) * 3600 || null) ??
    parseDurationSeconds(raw.estimate) ??
    parseDurationSeconds(raw.estimated) ??
    parseDurationSeconds(raw.budget)
  );
}

async function importEverhourInvoices(params: {
  organizationId: string;
  importedBy: string;
  json: unknown;
  boardMap: Map<string, Board>;
}) {
  const invoiceRecords = collectInvoiceRecords(params.json)
    .map(normalizeInvoice)
    .filter((invoice): invoice is NormalizedEverhourInvoice => Boolean(invoice));

  let imported = 0;

  for (const invoice of invoiceRecords) {
    const mappedBoardId =
      await resolveMappedTrelloBoard({
        organizationId: params.organizationId,
        externalId: invoice.projectExternalId,
      }) ??
      resolveExactBoardByName({
        name: invoice.clientName ?? invoice.projectName,
        boardMap: params.boardMap,
      });

    if (!mappedBoardId) continue;

    const externalId =
      invoice.externalId ??
      deterministicHash([
        invoice.invoiceNumber,
        mappedBoardId,
        invoice.invoiceDate,
        invoice.total,
        invoice.publicUrl,
      ]);

    const { error } = await supabase.from("client_invoices").upsert(
      {
        organization_id: params.organizationId,
        client_id: mappedBoardId,
        invoice_number: invoice.invoiceNumber,
        invoice_date: invoice.invoiceDate ? invoice.invoiceDate.slice(0, 10) : null,
        period_start: invoice.periodStart ? invoice.periodStart.slice(0, 10) : null,
        period_end: invoice.periodEnd ? invoice.periodEnd.slice(0, 10) : null,
        currency: invoice.currency ?? "USD",
        subtotal: invoice.subtotal,
        tax_total: invoice.taxTotal,
        total: invoice.total,
        status: invoice.status ?? "imported",
        source: "everhour_import",
        external_id: externalId,
        file_name: invoice.fileName,
        public_url: invoice.publicUrl,
        metadata: {
          imported_from: "everhour_json",
          imported_by: params.importedBy,
          imported_at: new Date().toISOString(),
          project_external_id: invoice.projectExternalId,
          raw: invoice.raw,
        },
        created_by: params.importedBy,
      },
      { onConflict: "organization_id,source,external_id" },
    );

    if (!error) imported += 1;
  }

  return imported;
}

async function importEverhourUsers(params: {
  organizationId: string;
  importedBy: string;
  json: unknown;
  profiles: Array<{ id: string; full_name: string | null; email: string | null }>;
}) {
  const users = collectEverhourUsers(params.json);
  if (users.length === 0) return 0;

  const profileByEmail = new Map(
    params.profiles
      .filter((profile) => profile.email)
      .map((profile) => [normalizeKey(profile.email), profile.id]),
  );
  const profileByName = new Map(
    params.profiles
      .filter((profile) => profile.full_name)
      .map((profile) => [normalizeKey(profile.full_name), profile.id]),
  );

  let mapped = 0;
  for (const user of users) {
    const userId =
      profileByEmail.get(normalizeKey(user.email)) ??
      profileByName.get(normalizeKey(user.name)) ??
      null;

    const { error } = await supabase.from("external_time_user_mappings").upsert(
      {
        organization_id: params.organizationId,
        source: "everhour",
        source_user_id: user.externalId,
        source_user_name: user.name,
        source_user_email: user.email,
        user_id: userId,
        created_by: params.importedBy,
        metadata: {
          role: user.role,
          status: user.status,
          raw: user.raw,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,source,source_user_id" },
    );

    if (!error && userId) mapped += 1;
  }

  return mapped;
}

async function getEverhourUserMappings(organizationId: string) {
  const { data, error } = await supabase
    .from("external_time_user_mappings")
    .select("source_user_id, user_id, source_user_name, source_user_email")
    .eq("organization_id", organizationId)
    .eq("source", "everhour");

  if (error) return new Map<string, {
    user_id: string | null;
    source_user_name: string | null;
    source_user_email: string | null;
  }>();

  return new Map(
    (data ?? []).map((row) => [
      String(row.source_user_id),
      {
        user_id: row.user_id as string | null,
        source_user_name: row.source_user_name as string | null,
        source_user_email: row.source_user_email as string | null,
      },
    ]),
  );
}

async function importEverhourProjects(params: {
  organizationId: string;
  json: unknown;
  boardMap: Map<string, Board>;
}) {
  const projects = collectEverhourProjects(params.json);
  if (projects.length === 0) return 0;

  let mapped = 0;
  for (const project of projects) {
    const boardId = resolveExactBoardByName({
      name: project.name,
      boardMap: params.boardMap,
    });
    if (!boardId) continue;

    await upsertMapping({
      organizationId: params.organizationId,
      source: "trello",
      externalType: "board",
      externalId: stripTrelloPrefix(project.externalId),
      internalTable: "clients",
      internalId: boardId,
      metadata: {
        mapped_from: "everhour_projects_json",
        status: project.status,
        budget_seconds: project.budgetSeconds,
        raw: project.raw,
      },
    });

    mapped += 1;
  }

  return mapped;
}

async function importEverhourEstimates(params: {
  organizationId: string;
  json: unknown;
  taskMap: Map<string, string>;
}) {
  const estimates = collectEverhourEstimateRecords(params.json);
  let updated = 0;

  for (const record of estimates) {
    const task = asRecord(record.task);
    const project = asRecord(record.project);
    const estimate = asRecord(record.estimate);
    const taskExternalId = getString(task, ["id"]);
    const projectExternalId = getString(project, ["id"]);
    const estimateSeconds = getNumber(estimate, ["total"]);
    if (!taskExternalId || !estimateSeconds || estimateSeconds <= 0) continue;

    const mappedTask = await resolveMappedTrelloTask({
      organizationId: params.organizationId,
      externalId: taskExternalId,
      taskMap: params.taskMap,
    });

    if (!mappedTask?.taskId) continue;

    const { error } = await supabase
      .from("tasks")
      .update({
        estimated_seconds: estimateSeconds,
      })
      .eq("organization_id", params.organizationId)
      .eq("id", mappedTask.taskId);

    if (!error) updated += 1;
  }

  return updated;
}

export async function importEverhourJson(params: {
  organizationId: string;
  importedBy: string;
  json: unknown;
  boards: Board[];
}): Promise<EverhourImportResult> {
  const candidates = collectCandidateRecords(params.json)
    .map(normalizeEntry)
    .filter((entry): entry is NormalizedEverhourEntry => Boolean(entry));

  const result: EverhourImportResult = {
    scanned: candidates.length,
    imported: 0,
    duplicates: 0,
    skipped: 0,
    boardsCreated: 0,
    tasksCreated: 0,
    usersMapped: 0,
    projectsMapped: 0,
    estimatesUpdated: 0,
    invoicesImported: 0,
    unmatchedUsers: [],
    errors: [],
  };

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("organization_id", params.organizationId);

  if (profilesError) throw new Error(profilesError.message);

  const usersByEmail = new Map(
    (profiles ?? [])
      .filter((profile) => profile.email)
      .map((profile) => [normalizeKey(profile.email), profile.id as string]),
  );
  const usersByName = new Map(
    (profiles ?? [])
      .filter((profile) => profile.full_name)
      .map((profile) => [normalizeKey(profile.full_name), profile.id as string]),
  );
  const boardMap = new Map(params.boards.map((board) => [normalizeKey(board.name), board]));

  const { data: existingTasks } = await supabase
    .from("tasks")
    .select("id, title, client_id")
    .eq("organization_id", params.organizationId);
  const taskMap = new Map(
    (existingTasks ?? []).map((task) => [
      `${task.client_id ?? "none"}::${normalizeKey(task.title)}`,
      task.id as string,
    ]),
  );

  result.usersMapped = await importEverhourUsers({
    organizationId: params.organizationId,
    importedBy: params.importedBy,
    json: params.json,
    profiles: (profiles ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>,
  });
  result.projectsMapped = await importEverhourProjects({
    organizationId: params.organizationId,
    json: params.json,
    boardMap,
  });
  result.estimatesUpdated = await importEverhourEstimates({
    organizationId: params.organizationId,
    json: params.json,
    taskMap,
  });
  const everhourUserMappings = await getEverhourUserMappings(params.organizationId);

  for (const entry of candidates) {
    const externalUserMapping = entry.userExternalId
      ? everhourUserMappings.get(String(entry.userExternalId))
      : null;
    const userId =
      usersByEmail.get(normalizeKey(entry.userEmail)) ??
      usersByName.get(normalizeKey(entry.userName)) ??
      externalUserMapping?.user_id;

    if (!userId) {
      result.skipped += 1;
      result.unmatchedUsers.push({
        name: entry.userName ?? externalUserMapping?.source_user_name ?? null,
        email: entry.userEmail ?? externalUserMapping?.source_user_email ?? null,
        externalId: entry.userExternalId,
        reason: "No matching profile by Everhour user id, email, or full name.",
      });
      continue;
    }

    try {
      const mappedTask = await resolveMappedTrelloTask({
        organizationId: params.organizationId,
        externalId: entry.taskExternalId,
        taskMap,
      });
      const mappedBoardId =
        mappedTask?.boardId ??
        await resolveMappedTrelloBoard({
          organizationId: params.organizationId,
          externalId: entry.projectExternalId,
        }) ??
        resolveExactBoardByName({
          name: entry.clientName ?? entry.projectName,
          boardMap,
        });

      if (!mappedBoardId) {
        result.skipped += 1;
        result.errors.push(
          `Skipped Everhour time for "${entry.taskName ?? "unknown task"}": no matching imported board/project.`,
        );
        continue;
      }

      const taskId =
        mappedTask?.taskId ??
        resolveExactTaskByTitle({
          boardId: mappedBoardId,
          title: entry.taskName,
          taskMap,
        });

      if (!taskId) {
        result.skipped += 1;
        result.errors.push(
          `Skipped Everhour time for "${entry.taskName ?? "unknown task"}": no matching imported card/task on board.`,
        );
        continue;
      }

      const estimateSeconds = parseEstimateSeconds(entry);
      if (estimateSeconds && estimateSeconds > 0) {
        const { error: estimateError } = await supabase
          .from("tasks")
          .update({ estimated_seconds: estimateSeconds })
          .eq("organization_id", params.organizationId)
          .eq("id", taskId);
        if (!estimateError) result.estimatesUpdated += 1;
      }

      const importHash = deterministicHash([
        "everhour",
        entry.externalId,
        taskId,
        userId,
        entry.startedAt,
        entry.endedAt,
        entry.durationSeconds,
      ]);

      const duplicate = await supabase
        .from("time_entries")
        .select("id")
        .eq("organization_id", params.organizationId)
        .eq("source", "everhour_import")
        .eq("import_hash", importHash)
        .limit(1)
        .maybeSingle();

      if (duplicate.error) throw new Error(duplicate.error.message);
      if (duplicate.data?.id) {
        result.duplicates += 1;
        continue;
      }

      const costAmount =
        entry.costAmount ??
        (entry.hourlyRate ? Math.round(entry.hourlyRate * (entry.durationSeconds / 3600) * 100) / 100 : null);

      const { error } = await supabase.from("time_entries").insert({
        organization_id: params.organizationId,
        user_id: userId,
        client_id: mappedBoardId,
        task_id: taskId,
        description: entry.description ?? entry.taskName ?? "Imported Everhour time entry",
        started_at: entry.startedAt,
        ended_at: entry.endedAt,
        is_running: false,
        duration_seconds: entry.durationSeconds,
        is_billable: entry.isBillable,
        hourly_rate_snapshot: entry.hourlyRate,
        cost_amount: costAmount,
        approval_status: entry.approvalStatus,
        source: "everhour_import",
        entry_type: "imported",
        source_entry_id: entry.externalId,
        source_card_id: entry.taskExternalId,
        source_board_id: entry.projectExternalId,
        source_user_id: entry.userExternalId,
        source_user_name: entry.userName,
        import_hash: importHash,
        metadata: {
          imported_from: "everhour_json",
          imported_by: params.importedBy,
          imported_at: new Date().toISOString(),
          everhour_external_id: entry.externalId,
          everhour_user_external_id: entry.userExternalId,
          everhour_project_external_id: entry.projectExternalId,
          everhour_task_external_id: entry.taskExternalId,
          mapped_from_trello_import: Boolean(mappedBoardId || mappedTask),
          zimbabwe_date: getZimbabweDateKey(entry.startedAt!),
          raw: entry.raw,
        },
      });

      if (error) throw new Error(error.message);
      result.imported += 1;
      await syncImportedTaskTimeCache({
        organizationId: params.organizationId,
        taskId,
      });
    } catch (error) {
      result.skipped += 1;
      result.errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  result.invoicesImported = await importEverhourInvoices({
    organizationId: params.organizationId,
    importedBy: params.importedBy,
    json: params.json,
    boardMap,
  });

  return result;
}

async function getOrCreateTrelloBoard(params: {
  organizationId: string;
  importedBy: string;
  boardRecord: JsonRecord;
  boards: Board[];
  importBatchId: string | null;
}) {
  const trelloBoardId = getString(params.boardRecord, ["id"]);
  const trelloShortLink = getString(params.boardRecord, ["shortLink"]);
  const boardName = getString(params.boardRecord, ["name"]) ?? "Imported Codex Board";

  const mapped = await getMapping({
    organizationId: params.organizationId,
    source: "trello",
    externalType: "board",
    externalId: trelloBoardId,
  });

  if (mapped?.internal_id) {
    await upsertMapping({
      organizationId: params.organizationId,
      source: "trello",
      externalType: "board_short_link",
      externalId: trelloShortLink,
      internalTable: "clients",
      internalId: mapped.internal_id,
      importBatchId: params.importBatchId,
      metadata: {
        trelloBoardId,
        url: getString(params.boardRecord, ["url", "shortUrl"]),
      },
    });
    return { boardId: mapped.internal_id, created: false, boardName };
  }

  const existing = params.boards.find((board) =>
    normalizeKey(board.name) === normalizeKey(boardName)
  );

  if (existing) {
    await upsertMapping({
      organizationId: params.organizationId,
      source: "trello",
      externalType: "board",
      externalId: trelloBoardId,
      internalTable: "clients",
      internalId: existing.id,
      importBatchId: params.importBatchId,
      metadata: {
        shortLink: trelloShortLink,
        url: getString(params.boardRecord, ["url", "shortUrl"]),
      },
    });
    await upsertMapping({
      organizationId: params.organizationId,
      source: "trello",
      externalType: "board_short_link",
      externalId: trelloShortLink,
      internalTable: "clients",
      internalId: existing.id,
      importBatchId: params.importBatchId,
      metadata: {
        trelloBoardId,
        url: getString(params.boardRecord, ["url", "shortUrl"]),
      },
    });
    return { boardId: existing.id, created: false, boardName };
  }

  const board = await createClient({
    organizationId: params.organizationId,
    name: boardName,
    website: getString(params.boardRecord, ["url", "shortUrl"]),
    industry: "Codex Import",
    notes: "Created from Codex board JSON import.",
    boardType: "client",
  });

  await upsertMapping({
    organizationId: params.organizationId,
    source: "trello",
    externalType: "board",
    externalId: trelloBoardId,
    internalTable: "clients",
    internalId: board.id,
    importBatchId: params.importBatchId,
    metadata: {
      shortLink: trelloShortLink,
      url: getString(params.boardRecord, ["url", "shortUrl"]),
      importedBy: params.importedBy,
    },
  });
  await upsertMapping({
    organizationId: params.organizationId,
    source: "trello",
    externalType: "board_short_link",
    externalId: trelloShortLink,
    internalTable: "clients",
    internalId: board.id,
    importBatchId: params.importBatchId,
    metadata: {
      trelloBoardId,
      url: getString(params.boardRecord, ["url", "shortUrl"]),
      importedBy: params.importedBy,
    },
  });

  return { boardId: board.id, created: true, boardName };
}

async function getOrCreateTrelloColumn(params: {
  organizationId: string;
  boardId: string;
  listRecord: JsonRecord;
  position: number;
  importBatchId: string | null;
}) {
  const trelloListId = getString(params.listRecord, ["id"]);
  const name = getString(params.listRecord, ["name"]) ?? "Imported List";
  const trelloPosition = getNumber(params.listRecord, ["pos"]);
  const matchedDefaultStatus = defaultStatusForTrelloListName(name);

  const mapped = await getMapping({
    organizationId: params.organizationId,
    source: "trello",
    externalType: "list",
    externalId: trelloListId,
  });

  if (mapped?.internal_id) {
    return { columnId: mapped.internal_id, status: statusFromTrelloListName(name), created: false, name };
  }

  const { data: existingColumns } = await supabase
    .from("task_board_columns")
    .select("id, name, position")
    .eq("organization_id", params.organizationId)
    .eq("client_id", params.boardId)
    .order("position", { ascending: true });

  const exactExisting = (existingColumns ?? []).find(
    (column) => normalizeColumnMatchKey(column.name) === normalizeColumnMatchKey(name),
  );
  const defaultExisting = matchedDefaultStatus
    ? (existingColumns ?? []).find(
      (column) =>
        defaultStatusForTrelloListName(column.name) === matchedDefaultStatus ||
        normalizeColumnMatchKey(column.name) === normalizeColumnMatchKey(
          matchedDefaultStatus === "in_progress" ? "In Progress" : matchedDefaultStatus,
        ),
    )
    : null;
  const reusableColumn = exactExisting ?? defaultExisting;

  if (reusableColumn?.id) {
    await upsertMapping({
      organizationId: params.organizationId,
      source: "trello",
      externalType: "list",
      externalId: trelloListId,
      internalTable: "task_board_columns",
      internalId: reusableColumn.id as string,
      importBatchId: params.importBatchId,
      metadata: {
        name,
        original_trello_list_name: name,
        position: params.position,
        trello_position: trelloPosition,
        matched_default_status: matchedDefaultStatus,
      },
    });
    return {
      columnId: reusableColumn.id as string,
      status: matchedDefaultStatus ?? statusFromTrelloListName(name),
      created: false,
      name,
    };
  }

  if (matchedDefaultStatus) {
    await upsertMapping({
      organizationId: params.organizationId,
      source: "trello",
      externalType: "list",
      externalId: trelloListId,
      internalTable: "task_status",
      internalId: null,
      importBatchId: params.importBatchId,
      metadata: {
        name,
        original_trello_list_name: name,
        matched_default_status: matchedDefaultStatus,
      },
    });
    return {
      columnId: null,
      status: matchedDefaultStatus,
      created: false,
      name,
    };
  }

  const maxPosition = (existingColumns ?? []).reduce(
    (max, column) => Math.max(max, Number(column.position ?? 0)),
    4,
  );

  const { data, error } = await supabase
    .from("task_board_columns")
    .insert({
      organization_id: params.organizationId,
      client_id: params.boardId,
      project_id: null,
      name: `Codex - ${name}`,
      position: maxPosition + 1 + params.position,
      color: null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await upsertMapping({
    organizationId: params.organizationId,
    source: "trello",
    externalType: "list",
    externalId: trelloListId,
    internalTable: "task_board_columns",
    internalId: data.id as string,
    importBatchId: params.importBatchId,
    metadata: {
      name: `Codex - ${name}`,
      original_trello_list_name: name,
      position: params.position,
      trello_position: trelloPosition,
    },
  });

  return { columnId: data.id as string, status: statusFromTrelloListName(name), created: true, name };
}

export async function importTrelloBoardJson(params: {
  organizationId: string;
  importedBy: string;
  json: unknown;
  boards: Board[];
  fileName?: string | null;
  importTrackedTime?: boolean;
}): Promise<TrelloBoardImportResult> {
  const boardRecord = asRecord(params.json);
  if (!boardRecord) throw new Error("Codex import expects one board JSON object.");

  const listRecords = asArray(boardRecord.lists)
    .map(asRecord)
    .filter((item): item is JsonRecord => Boolean(item));
  const cardRecords = asArray(boardRecord.cards)
    .map(asRecord)
    .filter((item): item is JsonRecord => Boolean(item));
  const memberRecords = asArray(boardRecord.members)
    .map(asRecord)
    .filter((item): item is JsonRecord => Boolean(item));
  const checklistRecords = asArray(boardRecord.checklists)
    .map(asRecord)
    .filter((item): item is JsonRecord => Boolean(item));
  const actionRecords = asArray(boardRecord.actions)
    .map(asRecord)
    .filter((item): item is JsonRecord => Boolean(item));

  const importBatchId = await createImportBatch({
    organizationId: params.organizationId,
    source: "trello",
    importType: "board",
    fileName: params.fileName,
    importedBy: params.importedBy,
  });

  const result: TrelloBoardImportResult = {
    boardName: getString(boardRecord, ["name"]) ?? "Imported Codex Board",
    boardId: null,
    scannedLists: listRecords.length,
    scannedCards: cardRecords.length,
    listsImported: 0,
    cardsImported: 0,
    duplicates: 0,
    assigneesLinked: 0,
    checklistsImported: 0,
    checklistItemsImported: 0,
    attachmentsImported: 0,
    commentsImported: 0,
    timeEntriesImported: 0,
    totalImportedSeconds: 0,
    importedTimeStatus: params.importTrackedTime === false ? "not_requested" : "no_time_data_found",
    unmatchedTimeUsers: [],
    unmatchedMembers: [],
    errors: [],
  };

  try {
    const board = await getOrCreateTrelloBoard({
      organizationId: params.organizationId,
      importedBy: params.importedBy,
      boardRecord,
      boards: params.boards,
      importBatchId,
    });

    result.boardId = board.boardId;
    result.boardName = board.boardName;

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("organization_id", params.organizationId);

    const profileByName = new Map(
      (profiles ?? [])
        .filter((profile) => profile.full_name)
        .map((profile) => [normalizeKey(profile.full_name), profile.id as string]),
    );
    const profileByEmail = new Map(
      (profiles ?? [])
        .filter((profile) => profile.email)
        .map((profile) => [normalizeKey(profile.email), profile.id as string]),
    );
    const profileByEmailPrefix = new Map(
      (profiles ?? [])
        .filter((profile) => profile.email)
        .map((profile) => [
          normalizeKey(String(profile.email).split("@")[0]),
          profile.id as string,
        ]),
    );

    const trelloMemberToProfile = new Map<string, string>();
    const trelloMemberRecords = new Map<string, JsonRecord>();
    for (const member of memberRecords) {
      const memberId = getString(member, ["id"]);
      if (!memberId) continue;
      trelloMemberRecords.set(memberId, member);

      const fullName = getString(member, ["fullName"]);
      const username = getString(member, ["username"]);
      const profileId =
        profileByName.get(normalizeKey(fullName)) ??
        profileByEmailPrefix.get(normalizeKey(username));

      if (profileId) {
        trelloMemberToProfile.set(memberId, profileId);
      } else {
        result.unmatchedMembers.push({
          trelloMemberId: memberId,
          name: fullName,
          username,
          reason: "No matching profile by Codex full name or username.",
        });
      }
    }

    const listIdToColumnId = new Map<string, string>();
    const listIdToStatus = new Map<string, string>();
    const listIdToName = new Map<string, string>();
    let visibleListPosition = 0;
    for (const list of listRecords) {
      if (getBoolean(list, ["closed"]) === true) continue;

      try {
        const column = await getOrCreateTrelloColumn({
          organizationId: params.organizationId,
          boardId: board.boardId,
          listRecord: list,
          position: visibleListPosition,
          importBatchId,
        });
        visibleListPosition += 1;
        const listId = getString(list, ["id"]);
        if (listId) {
          if (column.columnId) listIdToColumnId.set(listId, column.columnId);
          listIdToStatus.set(listId, column.status);
          listIdToName.set(listId, column.name);
        }
        if (column.created) result.listsImported += 1;
      } catch (error) {
        result.errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    const checklistByCard = new Map<string, JsonRecord[]>();
    for (const checklist of checklistRecords) {
      const cardId = getString(checklist, ["idCard"]);
      if (!cardId) continue;
      const list = checklistByCard.get(cardId) ?? [];
      list.push(checklist);
      checklistByCard.set(cardId, list);
    }

    const commentsByCard = new Map<string, JsonRecord[]>();
    const actionsByCard = new Map<string, JsonRecord[]>();
    for (const action of actionRecords) {
      const data = asRecord(action.data);
      const card = asRecord(data?.card);
      const cardId = getString(card, ["id"]);
      if (!cardId) continue;
      const actionList = actionsByCard.get(cardId) ?? [];
      actionList.push(action);
      actionsByCard.set(cardId, actionList);

      if (getString(action, ["type"]) === "commentCard") {
        const list = commentsByCard.get(cardId) ?? [];
        list.push(action);
        commentsByCard.set(cardId, list);
      }
    }

    const nextCardPositionByList = new Map<string, number>();
    for (const card of cardRecords) {
      const trelloCardId = getString(card, ["id"]);
      const mapped = await getMapping({
        organizationId: params.organizationId,
        source: "trello",
        externalType: "card",
        externalId: trelloCardId,
      });

      if (mapped?.internal_id) {
        result.duplicates += 1;
      }

      try {
        const listId = getString(card, ["idList"]);
        const columnId = listId ? listIdToColumnId.get(listId) ?? null : null;
        const mappedStatus = listId ? listIdToStatus.get(listId) ?? null : null;
        const listName = listId ? listIdToName.get(listId) ?? null : null;
        const labels = asArray(card.labels)
          .map(asRecord)
          .filter((item): item is JsonRecord => Boolean(item))
          .map(normalizeTrelloLabel);
        const memberIds = asArray(card.idMembers)
          .map((value) => String(value))
          .filter(Boolean);
        const assigneeIds = memberIds
          .map((memberId) => trelloMemberToProfile.get(memberId))
          .filter((id): id is string => Boolean(id));

        const title = getString(card, ["name"]) ?? "Untitled Trello card";
        const status = getBoolean(card, ["closed"]) === true
          ? "done"
          : mappedStatus ?? statusFromTrelloListName(listName);
        const positionKey = listId ?? "none";
        const position = nextCardPositionByList.get(positionKey) ?? 0;
        nextCardPositionByList.set(positionKey, position + 1);
        const trelloPosition = getNumber(card, ["pos"]);
        const dueDate = parseDate(getString(card, ["due"]));
        const shortLink = getString(card, ["shortLink"]);

        let taskId = mapped?.internal_id ?? null;
        const isExistingCard = Boolean(taskId);

        if (!taskId) {
          const { data: task, error } = await supabase
            .from("tasks")
            .insert({
              organization_id: params.organizationId,
              client_id: board.boardId,
              column_id: columnId,
              title,
              description: getString(card, ["desc"]) || null,
              status,
              priority: labels.some((label) =>
                  normalizeKey(label.name).includes("urgent") ||
                  normalizeKey(label.color).includes("red")
                )
                ? "urgent"
                : "medium",
              due_date: dueDate,
              position,
              is_billable: true,
              created_by: params.importedBy,
              imported_time_status: params.importTrackedTime === false ? "not_requested" : "no_time_data_found",
              metadata: {
                imported_from: "trello_board_json",
                trello_card_id: trelloCardId,
                trello_short_link: shortLink,
                trello_url: getString(card, ["url", "shortUrl"]),
                trello_list_id: listId,
                trello_list_name: listName,
                original_trello_list_name: listName,
                trello_position: trelloPosition,
                labels,
                raw_badges: card.badges ?? null,
                date_last_activity: getString(card, ["dateLastActivity"]),
              },
            })
            .select("id")
            .single();

          if (error) throw new Error(error.message);
          taskId = task.id as string;
          result.cardsImported += 1;
        }

        if (!isExistingCard) {
          await upsertMapping({
            organizationId: params.organizationId,
            source: "trello",
            externalType: "card",
            externalId: trelloCardId,
            internalTable: "tasks",
            internalId: taskId,
            importBatchId,
            metadata: { shortLink, title, listId, listName },
          });

          if (shortLink) {
            await upsertMapping({
              organizationId: params.organizationId,
              source: "trello",
              externalType: "card_short_link",
              externalId: shortLink,
              internalTable: "tasks",
              internalId: taskId,
              importBatchId,
              metadata: { trelloCardId, title },
            });
          }
        }

        if (!isExistingCard && assigneeIds.length > 0) {
          const { error: assigneeError } = await supabase
            .from("task_assignees")
            .upsert(
              assigneeIds.map((userId) => ({
                organization_id: params.organizationId,
                task_id: taskId,
                user_id: userId,
              })),
              { onConflict: "organization_id,task_id,user_id" },
            );

          if (!assigneeError) result.assigneesLinked += assigneeIds.length;
        }

        const cardChecklists = isExistingCard ? [] : checklistByCard.get(trelloCardId ?? "") ?? [];
        for (const [checklistIndex, checklist] of cardChecklists.entries()) {
          const { data: newChecklist, error: checklistError } = await supabase
            .from("task_checklists")
            .insert({
              task_id: taskId,
              organization_id: params.organizationId,
              title: getString(checklist, ["name"]) ?? "Checklist",
              created_by: params.importedBy,
              position: checklistIndex,
            })
            .select("id")
            .single();

          if (checklistError) continue;
          result.checklistsImported += 1;

          const items = asArray(checklist.checkItems)
            .map(asRecord)
            .filter((item): item is JsonRecord => Boolean(item));

          if (items.length > 0) {
            const { error: itemError } = await supabase
              .from("task_checklist_items")
              .insert(
                items.map((item, itemIndex) => ({
                  checklist_id: newChecklist.id,
                  task_id: taskId,
                  organization_id: params.organizationId,
                  content: getString(item, ["name"]) ?? "Checklist item",
                  is_completed: getString(item, ["state"]) === "complete",
                  created_by: params.importedBy,
                  position: itemIndex,
                })),
              );

            if (!itemError) result.checklistItemsImported += items.length;
          }
        }

        const attachments = isExistingCard ? [] : asArray(card.attachments)
          .map(asRecord)
          .filter((item): item is JsonRecord => Boolean(item));
        if (attachments.length > 0) {
          const { error: attachmentError } = await supabase
            .from("task_attachments")
            .insert(
              attachments.map((attachment) => ({
                organization_id: params.organizationId,
                task_id: taskId,
                uploaded_by: params.importedBy,
                attachment_type: "link",
                file_name: getString(attachment, ["name"]) ?? "Trello attachment",
                file_url: getString(attachment, ["url"]),
                metadata: {
                  imported_from: "trello_board_json",
                  trello_attachment_id: getString(attachment, ["id"]),
                  bytes: getNumber(attachment, ["bytes"]),
                },
              })),
            );

          if (!attachmentError) result.attachmentsImported += attachments.length;
        }

        const comments = isExistingCard ? [] : commentsByCard.get(trelloCardId ?? "") ?? [];
        if (comments.length > 0) {
          const { error: commentError } = await supabase
            .from("task_comments")
            .insert(
              comments.map((action) => {
                const data = asRecord(action.data);
                const memberCreator = asRecord(action.memberCreator);
                return {
                  organization_id: params.organizationId,
                  task_id: taskId,
                  user_id: params.importedBy,
                  comment: `${getString(data, ["text"]) ?? "Imported Trello comment"}${
                    getString(memberCreator, ["fullName", "username"])
                      ? `\n\nImported from Trello by ${getString(memberCreator, ["fullName", "username"])}.`
                      : ""
                  }`,
                  is_internal: false,
                  created_at: parseDate(getString(action, ["date"])) ?? new Date().toISOString(),
                };
              }),
            );

          if (!commentError) result.commentsImported += comments.length;
        }

        if (params.importTrackedTime !== false) {
          const timeSources: unknown[] = [
            asArray(card.pluginData)
              .map(asRecord)
              .filter((item): item is JsonRecord => Boolean(item))
              .map(parsePluginValue),
            card.customFieldItems,
            card.customFields,
          ];
          const normalizedTimeEntries = collectTrelloTimeCandidateRecords(timeSources)
            .map((record) =>
              normalizeTrelloTimeEntry({
                record,
                cardId: trelloCardId,
                boardId: getString(boardRecord, ["id"]),
                memberLookup: trelloMemberRecords,
              }),
            )
            .filter((entry): entry is NormalizedTrelloTimeEntry => Boolean(entry));

          if (normalizedTimeEntries.length > 0) {
            await supabase
              .from("tasks")
              .update({ imported_time_status: "imported" })
              .eq("organization_id", params.organizationId)
              .eq("id", taskId);
          }

          for (const timeEntry of normalizedTimeEntries) {
            const userId = profileByEmail.get(normalizeKey(timeEntry.sourceUserEmail));
            const effectiveSourceUserId =
              timeEntry.sourceUserId ??
              deterministicHash([timeEntry.sourceUserName, timeEntry.sourceUserEmail]);
            const importHash = deterministicHash([
              "trello",
              timeEntry.sourceEntryId,
              timeEntry.sourceCardId,
              timeEntry.durationSeconds,
              effectiveSourceUserId,
              timeEntry.sourceUserName,
              timeEntry.startedAt,
            ]);

            const duplicate = await supabase
              .from("time_entries")
              .select("id")
              .eq("organization_id", params.organizationId)
              .eq("source", "trello_import")
              .eq("import_hash", importHash)
              .maybeSingle();

            if (duplicate.error) throw new Error(duplicate.error.message);
            if (duplicate.data?.id) continue;

            const { error: timeError } = await supabase.from("time_entries").insert({
              organization_id: params.organizationId,
              user_id: userId ?? null,
              client_id: board.boardId,
              task_id: taskId,
              description: timeEntry.description,
              started_at: timeEntry.startedAt,
              ended_at: timeEntry.endedAt,
              is_running: false,
              duration_seconds: timeEntry.durationSeconds,
              is_billable: true,
              approval_status: "approved",
              source: "trello_import",
              entry_type: timeEntry.entryType,
              source_entry_id: timeEntry.sourceEntryId,
              source_card_id: timeEntry.sourceCardId,
              source_board_id: timeEntry.sourceBoardId,
              source_user_id: effectiveSourceUserId,
              source_user_name: timeEntry.sourceUserName,
              import_hash: importHash,
              metadata: {
                imported_from: "trello_board_json",
                imported_by: params.importedBy,
                imported_at: new Date().toISOString(),
                provider: timeEntry.provider,
                source_user_email: timeEntry.sourceUserEmail,
                source_user_id: effectiveSourceUserId,
                source_user_name: timeEntry.sourceUserName,
                original_trello_list_name: listName,
                raw: timeEntry.raw,
              },
            });

            if (timeError) throw new Error(timeError.message);

            result.timeEntriesImported += 1;
            result.totalImportedSeconds += timeEntry.durationSeconds;
            result.importedTimeStatus = "imported";

            if (!userId) {
              result.unmatchedTimeUsers.push({
                sourceUserId: effectiveSourceUserId,
                sourceUserName: timeEntry.sourceUserName,
                sourceUserEmail: timeEntry.sourceUserEmail,
                durationSeconds: timeEntry.durationSeconds,
              });

              if (effectiveSourceUserId || timeEntry.sourceUserName || timeEntry.sourceUserEmail) {
                await supabase.from("external_time_user_mappings").upsert(
                  {
                    organization_id: params.organizationId,
                    source: "trello",
                    source_user_id: effectiveSourceUserId,
                    source_user_name: timeEntry.sourceUserName,
                    source_user_email: timeEntry.sourceUserEmail,
                    user_id: null,
                    created_by: params.importedBy,
                    metadata: {
                      source_board_id: timeEntry.sourceBoardId,
                      provider: timeEntry.provider,
                    },
                    updated_at: new Date().toISOString(),
                  },
                  { onConflict: "organization_id,source,source_user_id" },
                );
              }
            }
          }

          if (normalizedTimeEntries.length > 0) {
            await syncImportedTaskTimeCache({
              organizationId: params.organizationId,
              taskId,
            });
          }
        }
      } catch (error) {
        result.errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    if (params.importTrackedTime !== false && result.timeEntriesImported === 0) {
      result.importedTimeStatus = "no_time_data_found";
    }

    await supabase.from("import_logs").insert({
      organization_id: params.organizationId,
      source: "trello",
      source_board_id: getString(boardRecord, ["id"]),
      imported_by: params.importedBy,
      status: result.errors.length > 0 ? "completed_with_errors" : "completed",
      total_boards: 1,
      total_cards: result.cardsImported,
      total_time_entries: result.timeEntriesImported,
      unmatched_users_count: result.unmatchedTimeUsers.length,
      errors: result.errors,
    });

    await finishImportBatch({
      batchId: importBatchId,
      status: "completed",
      summary: result as unknown as Record<string, unknown>,
    });

    return result;
  } catch (error) {
    await finishImportBatch({
      batchId: importBatchId,
      status: "failed",
      summary: result as unknown as Record<string, unknown>,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export type ExternalTimeUserMapping = {
  id: string;
  source_user_id: string;
  source_user_name: string | null;
  source_user_email: string | null;
  user_id: string | null;
};

export async function getUnmatchedExternalTimeUsers(organizationId: string) {
  const { data, error } = await supabase
    .from("external_time_user_mappings")
    .select("id, source_user_id, source_user_name, source_user_email, user_id")
    .eq("organization_id", organizationId)
    .eq("source", "trello")
    .is("user_id", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("UNMATCHED EXTERNAL USERS LOOKUP SKIPPED:", error.message);
    return [] as ExternalTimeUserMapping[];
  }

  return (data ?? []) as ExternalTimeUserMapping[];
}

export async function mapExternalTimeUser(params: {
  organizationId: string;
  mappingId: string;
  sourceUserId: string;
  userId: string;
}) {
  const now = new Date().toISOString();
  const { error: mappingError } = await supabase
    .from("external_time_user_mappings")
    .update({ user_id: params.userId, updated_at: now })
    .eq("organization_id", params.organizationId)
    .eq("id", params.mappingId);

  if (mappingError) throw new Error(mappingError.message);

  const { error: entriesError } = await supabase
    .from("time_entries")
    .update({
      user_id: params.userId,
    })
    .eq("organization_id", params.organizationId)
    .eq("source", "trello_import")
    .eq("source_user_id", params.sourceUserId)
    .is("user_id", null);

  if (entriesError) throw new Error(entriesError.message);
}
