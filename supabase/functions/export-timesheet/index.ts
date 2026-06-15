import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function response(body: BodyInit, headers: Record<string, string>, status = 200) {
  return new Response(body, {
    status,
    headers: { ...corsHeaders, ...headers },
  });
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function jsonResponse(body: unknown, status = 200) {
  return response(JSON.stringify(body, null, 2), {
    "Content-Type": "application/json",
  }, status);
}

function htmlEscape(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const format = (url.searchParams.get("format") ?? "json").toLowerCase();

    if (!userId || !from || !to) {
      return jsonResponse({ error: "userId, from, and to are required." }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return jsonResponse({ error: "Export function is not configured." }, 500);
    }

    const authHeader = req.headers.get("authorization") ?? "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return jsonResponse({ error: "Missing Authorization bearer token." }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser();

    if (authError || !authData.user) {
      return jsonResponse({ error: "Invalid or expired session." }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: currentProfile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, organization_id, full_name, email, primary_role")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!currentProfile?.organization_id) {
      return jsonResponse({ error: "Missing organization context." }, 403);
    }

    const role = String(currentProfile.primary_role ?? "").toLowerCase();
    const isManager = [
      "admin",
      "manager",
      "hr",
      "superadmin",
      "super_admin",
      "it-superadmin",
      "it",
      "org_admin",
    ].includes(role);

    if (userId !== currentProfile.id && !isManager) {
      return jsonResponse({ error: "You can only export your own timesheet." }, 403);
    }

    const { data: targetProfile, error: targetError } = await adminClient
      .from("profiles")
      .select("id, full_name, email")
      .eq("organization_id", currentProfile.organization_id)
      .eq("id", userId)
      .maybeSingle();

    if (targetError) throw targetError;
    if (!targetProfile) {
      return jsonResponse({ error: "Timesheet user not found." }, 404);
    }

    const fromIso = `${from.slice(0, 10)}T00:00:00.000Z`;
    const toIso = `${to.slice(0, 10)}T23:59:59.999Z`;

    const { data: entriesRaw, error: entriesError } = await adminClient
      .from("time_entries")
      .select(
        "id, task_id, client_id, description, started_at, ended_at, duration_seconds, is_running, is_billable, approval_status",
      )
      .eq("organization_id", currentProfile.organization_id)
      .eq("user_id", userId)
      .gte("started_at", fromIso)
      .lte("started_at", toIso)
      .order("started_at", { ascending: false })
      .limit(1000);

    if (entriesError) throw entriesError;

    const entries = entriesRaw ?? [];

    const taskIds = [...new Set(entries.map((e) => e.task_id).filter(Boolean))];
    const boardIds = [...new Set(entries.map((e) => e.client_id).filter(Boolean))];

    const tasksById = new Map<string, any>();
    const boardsById = new Map<string, any>();

    if (taskIds.length > 0) {
      const { data: tasks, error } = await adminClient
        .from("tasks")
        .select("id, title, client_id")
        .eq("organization_id", currentProfile.organization_id)
        .in("id", taskIds);

      if (error) throw error;

      for (const task of tasks ?? []) {
        tasksById.set(task.id, task);
        if (task.client_id) boardIds.push(task.client_id);
      }
    }

    const uniqueBoardIds = [...new Set(boardIds.filter(Boolean))];

    if (uniqueBoardIds.length > 0) {
      const { data: boards, error } = await adminClient
        .from("clients")
        .select("id, name")
        .eq("organization_id", currentProfile.organization_id)
        .in("id", uniqueBoardIds);

      if (error) throw error;

      for (const board of boards ?? []) {
        boardsById.set(board.id, board);
      }
    }

    const rows = entries.map((entry) => {
      const task = entry.task_id ? tasksById.get(entry.task_id) : null;
      const boardId = entry.client_id ?? task?.client_id ?? null;
      const board = boardId ? boardsById.get(boardId) : null;
      const seconds = Number(entry.duration_seconds ?? 0);

      return {
        date: String(entry.started_at ?? "").slice(0, 10),
        task: task?.title ?? entry.description ?? "Untitled work",
        board: board?.name ?? "No board",
        startedAt: entry.started_at,
        endedAt: entry.ended_at,
        hours: Number((seconds / 3600).toFixed(2)),
        durationSeconds: seconds,
        billable: Boolean(entry.is_billable),
        approvalStatus: entry.approval_status ?? "",
      };
    });

    const totalHours = Number(
      rows.reduce((sum, row) => sum + row.hours, 0).toFixed(2),
    );

    const filenameBase = `timesheet-${targetProfile.full_name ?? "user"}-${from}-to-${to}`
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-");

    const payload = {
      user: {
        id: targetProfile.id,
        name: targetProfile.full_name,
        email: targetProfile.email,
      },
      range: { from, to },
      totalHours,
      entryCount: rows.length,
      entries: rows,
    };

    if (format === "json") {
      return response(JSON.stringify(payload, null, 2), {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filenameBase}.json"`,
      });
    }

    if (format === "csv" || format === "xlsx") {
      const headers = [
        "Date",
        "Task",
        "Board",
        "Started At",
        "Ended At",
        "Hours",
        "Duration Seconds",
        "Billable",
        "Approval Status",
      ];

      const csv = [
        headers.map(csvEscape).join(","),
        ...rows.map((row) =>
          [
            row.date,
            row.task,
            row.board,
            row.startedAt,
            row.endedAt,
            row.hours,
            row.durationSeconds,
            row.billable ? "Yes" : "No",
            row.approvalStatus,
          ].map(csvEscape).join(",")
        ),
      ].join("\n");

      return response(csv, {
        "Content-Type": format === "xlsx"
          ? "application/vnd.ms-excel"
          : "text/csv",
        "Content-Disposition": `attachment; filename="${filenameBase}.${format === "xlsx" ? "xls" : "csv"}"`,
      });
    }

    if (format === "pdf" || format === "html") {
      const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Timesheet</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 32px; color: #111; }
    h1 { margin-bottom: 4px; }
    .meta { color: #555; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f4f4f4; }
    .total { margin: 18px 0; font-weight: bold; }
  </style>
</head>
<body>
  <h1>Timesheet</h1>
  <div class="meta">
    <div><strong>Name:</strong> ${htmlEscape(targetProfile.full_name)}</div>
    <div><strong>Email:</strong> ${htmlEscape(targetProfile.email)}</div>
    <div><strong>Period:</strong> ${htmlEscape(from)} to ${htmlEscape(to)}</div>
  </div>
  <div class="total">Total tracked: ${totalHours} hours</div>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Task</th>
        <th>Board</th>
        <th>Hours</th>
        <th>Started</th>
        <th>Ended</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map((row) => `
        <tr>
          <td>${htmlEscape(row.date)}</td>
          <td>${htmlEscape(row.task)}</td>
          <td>${htmlEscape(row.board)}</td>
          <td>${htmlEscape(row.hours)}</td>
          <td>${htmlEscape(row.startedAt)}</td>
          <td>${htmlEscape(row.endedAt)}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>
</body>
</html>`;

      return response(html, {
        "Content-Type": "text/html",
        "Content-Disposition": `attachment; filename="${filenameBase}.html"`,
      });
    }

    return jsonResponse({ error: `Unsupported format: ${format}` }, 400);
  } catch (error) {
    console.error("export-timesheet error:", error);
    return jsonResponse({
      error: error instanceof Error ? error.message : "Export failed.",
    }, 500);
  }
});