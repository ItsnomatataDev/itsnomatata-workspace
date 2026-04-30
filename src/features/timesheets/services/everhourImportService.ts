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
    userExternalId: getString(user, ["id", "externalId"]) ?? getString(record, ["userId", "memberId"]),
    projectExternalId:
      getString(project, ["id", "externalId", "shortLink"]) ??
      getString(record, ["projectId", "projectExternalId", "boardId", "boardExternalId"]) ??
      getFirstStringFromArray(task?.projects),
    taskExternalId:
      getString(task, ["id", "externalId", "shortLink"]) ??
      getString(record, ["taskId", "taskExternalId", "issueId"]),
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

  for (const entry of candidates) {
    const userId =
      usersByEmail.get(normalizeKey(entry.userEmail)) ??
      usersByName.get(normalizeKey(entry.userName));

    if (!userId) {
      result.skipped += 1;
      result.unmatchedUsers.push({
        name: entry.userName,
        email: entry.userEmail,
        externalId: entry.userExternalId,
        reason: "No matching profile by email or full name.",
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
        });

      const boardName = entry.clientName ?? entry.projectName;
      const board = mappedBoardId
        ? { boardId: mappedBoardId, created: false }
        : await getOrCreateBoard({
          organizationId: params.organizationId,
          name: boardName,
          boardMap,
        });
      if (board.created) result.boardsCreated += 1;

      const task = mappedTask
        ? { taskId: mappedTask.taskId, created: false }
        : await getOrCreateTask({
          organizationId: params.organizationId,
          boardId: board.boardId,
          title: entry.taskName,
          taskMap,
        });
      if (task.created) result.tasksCreated += 1;

      const duplicate = await supabase
        .from("time_entries")
        .select("id")
        .eq("organization_id", params.organizationId)
        .eq("user_id", userId)
        .eq("started_at", entry.startedAt)
        .eq("ended_at", entry.endedAt)
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
        client_id: board.boardId,
        task_id: task.taskId,
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
    } catch (error) {
      result.skipped += 1;
      result.errors.push(error instanceof Error ? error.message : String(error));
    }
  }

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
  const boardName = getString(params.boardRecord, ["name"]) ?? "Imported Trello Board";

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
    industry: "Trello Import",
    notes: "Created from Trello board JSON import.",
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

  const mapped = await getMapping({
    organizationId: params.organizationId,
    source: "trello",
    externalType: "list",
    externalId: trelloListId,
  });

  if (mapped?.internal_id) {
    return { columnId: mapped.internal_id, created: false, name };
  }

  const { data: existing } = await supabase
    .from("task_board_columns")
    .select("id")
    .eq("organization_id", params.organizationId)
    .eq("client_id", params.boardId)
    .ilike("name", name)
    .maybeSingle();

  if (existing?.id) {
    await upsertMapping({
      organizationId: params.organizationId,
      source: "trello",
      externalType: "list",
      externalId: trelloListId,
      internalTable: "task_board_columns",
      internalId: existing.id as string,
      importBatchId: params.importBatchId,
      metadata: { name, position: params.position, trello_position: trelloPosition },
    });
    return { columnId: existing.id as string, created: false, name };
  }

  const { data, error } = await supabase
    .from("task_board_columns")
    .insert({
      organization_id: params.organizationId,
      client_id: params.boardId,
      project_id: null,
      name,
      position: params.position,
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
    metadata: { name, position: params.position, trello_position: trelloPosition },
  });

  return { columnId: data.id as string, created: true, name };
}

export async function importTrelloBoardJson(params: {
  organizationId: string;
  importedBy: string;
  json: unknown;
  boards: Board[];
  fileName?: string | null;
}): Promise<TrelloBoardImportResult> {
  const boardRecord = asRecord(params.json);
  if (!boardRecord) throw new Error("Trello import expects one board JSON object.");

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
    boardName: getString(boardRecord, ["name"]) ?? "Imported Trello Board",
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
    const profileByEmailPrefix = new Map(
      (profiles ?? [])
        .filter((profile) => profile.email)
        .map((profile) => [
          normalizeKey(String(profile.email).split("@")[0]),
          profile.id as string,
        ]),
    );

    const trelloMemberToProfile = new Map<string, string>();
    for (const member of memberRecords) {
      const memberId = getString(member, ["id"]);
      if (!memberId) continue;

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
          reason: "No matching profile by Trello full name or username.",
        });
      }
    }

    const listIdToColumnId = new Map<string, string>();
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
          listIdToColumnId.set(listId, column.columnId);
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
    for (const action of actionRecords) {
      if (getString(action, ["type"]) !== "commentCard") continue;
      const data = asRecord(action.data);
      const card = asRecord(data?.card);
      const cardId = getString(card, ["id"]);
      if (!cardId) continue;
      const list = commentsByCard.get(cardId) ?? [];
      list.push(action);
      commentsByCard.set(cardId, list);
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
        continue;
      }

      try {
        const listId = getString(card, ["idList"]);
        const columnId = listId ? listIdToColumnId.get(listId) ?? null : null;
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
          : statusFromTrelloListName(listName);
        const positionKey = listId ?? "none";
        const position = nextCardPositionByList.get(positionKey) ?? 0;
        nextCardPositionByList.set(positionKey, position + 1);
        const trelloPosition = getNumber(card, ["pos"]);
        const dueDate = parseDate(getString(card, ["due"]));
        const shortLink = getString(card, ["shortLink"]);

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
            metadata: {
              imported_from: "trello_board_json",
              trello_card_id: trelloCardId,
              trello_short_link: shortLink,
              trello_url: getString(card, ["url", "shortUrl"]),
              trello_list_id: listId,
              trello_list_name: listName,
              trello_position: trelloPosition,
              labels,
              raw_badges: card.badges ?? null,
              date_last_activity: getString(card, ["dateLastActivity"]),
            },
          })
          .select("id")
          .single();

        if (error) throw new Error(error.message);

        const taskId = task.id as string;
        result.cardsImported += 1;

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

        if (assigneeIds.length > 0) {
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

        const cardChecklists = checklistByCard.get(trelloCardId ?? "") ?? [];
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

        const attachments = asArray(card.attachments)
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

        const comments = commentsByCard.get(trelloCardId ?? "") ?? [];
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
      } catch (error) {
        result.errors.push(error instanceof Error ? error.message : String(error));
      }
    }

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
