import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const action = body?.action;

    if (action === "chat") {
      return new Response(
        JSON.stringify({
          message:
            "Your AI assistant backend is now connected. Next, plug this function into OpenAI or your n8n workflow.",
          suggestions: [
            "Summarize my tasks",
            "Draft a report update",
            "What should I focus on today?",
          ],
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (action === "dashboard_summary") {
      return new Response(
        JSON.stringify({
          summary:
            "This is your dashboard AI summary. Next step is to inject real data from tasks, notifications, approvals, and time tracking.",
          suggestions: [
            "Summarize pending work",
            "Show important updates",
            "Draft my daily update",
          ],
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (action === "it_workspace_summary") {
      return new Response(
        JSON.stringify({
          summary:
            "This is the IT workspace summary. Next step is to inject live project, workflow, issue, and system health data.",
          suggestions: [
            "Show workflow issues",
            "Summarize project progress",
            "What should IT do next?",
          ],
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        message: "Unknown AI action received.",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});
