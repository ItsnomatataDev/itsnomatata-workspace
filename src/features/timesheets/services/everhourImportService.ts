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

type NormalizedEverhourEntry = {
  externalId: string | null;
  userEmail: string | null;
  userName: string | null;
  userExternalId: string | null;
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
      const boardName = entry.clientName ?? entry.projectName;
      const board = await getOrCreateBoard({
        organizationId: params.organizationId,
        name: boardName,
        boardMap,
      });
      if (board.created) result.boardsCreated += 1;

      const task = await getOrCreateTask({
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
