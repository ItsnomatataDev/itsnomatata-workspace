import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * Legacy stub — the real AI assistance function now lives at
 * supabase/functions/ai-assistance/index.ts
 *
 * This file is kept for backward-compatibility. It proxies all
 * requests to the main function logic.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function callOpenAI(
  systemPrompt: string,
  userMessage: string,
): Promise<string | null> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return null;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json();
    const action = body?.action;
    const chatInput = body?.chatInput ?? body?.message ?? "";
    const context = body?.context ?? {};
    const role = context?.role?.replace?.(/_/g, " ") ?? "employee";
    const name = context?.fullName ?? "User";

    const systemPrompt = [
      "You are a workspace AI assistant for an internal business platform.",
      "Be concise, operational, and action-oriented.",
      context?.role ? `User role: ${role}` : "",
      context?.fullName ? `User: ${name}` : "",
      context?.currentModule ? `Module: ${context.currentModule}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    // Try OpenAI first
    const aiReply = await callOpenAI(
      systemPrompt,
      chatInput || `action: ${action}`,
    );

    if (action === "chat" || action === "sendMessage") {
      const reply = aiReply ??
        `Hi ${name}, your AI assistant is connected. Configure OPENAI_API_KEY for intelligent responses.`;

      return jsonResponse({
        success: true,
        output: reply,
        message: reply,
        type: "text",
        requestId: crypto.randomUUID(),
        data: {},
        actions: [],
        sources: [],
      });
    }

    if (action === "dashboard_summary") {
      const reply = aiReply ??
        `Dashboard summary for ${name} (${role}). Review pending tasks, approvals, and team updates. Set OPENAI_API_KEY for AI-driven summaries.`;

      return jsonResponse({
        success: true,
        output: reply,
        message: reply,
        summary: reply,
        type: "text",
        data: {
          summary: reply,
          suggestions: [
            "Check overdue tasks and blockers",
            "Review pending approvals",
            "Follow up on team activity",
          ],
        },
      });
    }

    if (action === "it_workspace_summary") {
      const reply = aiReply ??
        "IT workspace summary: Review active projects, system health, and open issues. Set OPENAI_API_KEY for AI-powered analysis.";

      return jsonResponse({
        success: true,
        output: reply,
        message: reply,
        type: "text",
        data: { summary: reply },
      });
    }

    // Default: treat as generic AI request
    const reply = aiReply ??
      `Received action: ${
        action ?? "unknown"
      }. Configure OPENAI_API_KEY for intelligent processing.`;

    return jsonResponse({
      success: true,
      output: reply,
      message: reply,
      type: "text",
      requestId: crypto.randomUUID(),
      data: {},
      actions: [],
      sources: [],
    });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        type: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});
