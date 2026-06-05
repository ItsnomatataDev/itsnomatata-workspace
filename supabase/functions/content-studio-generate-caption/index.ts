import {
  canUseContentStudio,
  requireAuthenticatedProfile,
} from "../_shared/edgeAuth.ts";

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

type CaptionRequest = {
  clientName?: string;
  postTitle?: string;
  existingCaption?: string;
  mediaDescription?: string;
  platform?: string;
  tone?: string;
  instruction?: string;
};

async function callOpenAI(prompt: string) {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You generate social media caption suggestions. Return JSON only with keys generatedCaption, hashtags (array), shortAlternative.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return String(data.choices?.[0]?.message?.content ?? "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const auth = await requireAuthenticatedProfile(req);
    if (auth instanceof Response) {
      return new Response(await auth.text(), {
        status: auth.status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!canUseContentStudio(auth.profile)) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const body = (await req.json()) as CaptionRequest;
    const prompt = [
      `Client: ${body.clientName ?? "Unknown client"}`,
      `Post title: ${body.postTitle ?? "Untitled post"}`,
      body.platform ? `Platform: ${body.platform}` : null,
      body.tone ? `Tone: ${body.tone}` : null,
      body.mediaDescription ? `Media description: ${body.mediaDescription}` : null,
      body.existingCaption ? `Existing caption: ${body.existingCaption}` : null,
      body.instruction ? `Instruction: ${body.instruction}` : null,
      "",
      "Do not include sensitive client data. Keep suggestions safe and brand-neutral.",
      "Return strict JSON: { generatedCaption, hashtags, shortAlternative }",
    ]
      .filter(Boolean)
      .join("\n");

    const aiText = await callOpenAI(prompt);
    const parsed = JSON.parse(aiText) as {
      generatedCaption?: string;
      hashtags?: string[];
      shortAlternative?: string;
    };

    return jsonResponse({
      generatedCaption: parsed.generatedCaption ?? "",
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
      shortAlternative: parsed.shortAlternative ?? "",
    });
  } catch (error) {
    console.error("CONTENT CAPTION GENERATION ERROR", error);
    return jsonResponse({ error: "Failed to generate caption." }, 500);
  }
});
