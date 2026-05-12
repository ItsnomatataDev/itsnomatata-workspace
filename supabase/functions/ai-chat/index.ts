import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// Types - AI Core Layer
// ============================================================

interface AIChatRequest {
  assistantId?: string;
  message: string;
  conversationId?: string;
  customerId?: string;
  channel: 'internal' | 'website' | 'whatsapp' | 'email';
  context?: {
    userId?: string;
    organizationId?: string;
    role?: string;
    fullName?: string;
    department?: string;
    currentModule?: string;
    currentRoute?: string;
    timezone?: string;
    metadata?: Record<string, unknown>;
  };
  attachments?: Array<{
    name?: string;
    type?: string;
    url?: string;
    mimeType?: string;
    textContent?: string;
  }>;
}

interface AIAssistant {
  id: string;
  organization_id: string;
  name: string;
  assistant_type: string;
  description?: string;
  system_prompt?: string;
  enabled: boolean;
  settings: Record<string, unknown>;
}

interface Conversation {
  id: string;
  organization_id: string;
  user_id?: string;
  customer_id?: string;
  assistant_id?: string;
  channel: string;
  title: string;
  status: string;
  metadata: Record<string, unknown>;
}

interface KnowledgeChunk {
  id: string;
  source_id: string;
  organization_id: string;
  chunk_text: string;
  embedding: number[];
  metadata: Record<string, unknown>;
}

// ============================================================
// CORS Configuration
// ============================================================

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

// ============================================================
// OpenAI Integration
// ============================================================

async function callOpenAI(
  systemPrompt: string,
  userMessage: string,
  model = "gpt-4o",
): Promise<string> {
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
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "No response generated.";
}

// ============================================================
// Vector Embedding for Knowledge Retrieval
// ============================================================

async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured for embeddings.");
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI Embeddings API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.data?.[0]?.embedding ?? [];
}

// ============================================================
// Supabase Client (Service Role)
// ============================================================

function getSupabaseClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.");
  }
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// ============================================================
// Knowledge Retrieval
// ============================================================

async function retrieveRelevantKnowledge(
  supabase: ReturnType<typeof getSupabaseClient>,
  organizationId: string,
  query: string,
  limit = 5,
): Promise<string[]> {
  try {
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);

    // Search for similar chunks using pgvector
    const { data: chunks, error } = await supabase
      .rpc('search_knowledge_chunks', {
        p_organization_id: organizationId,
        p_query_embedding: queryEmbedding,
        p_match_threshold: 0.7,
        p_match_count: limit
      });

    if (error) {
      console.error('Knowledge retrieval error:', error);
      return [];
    }

    return (chunks as KnowledgeChunk[])?.map((chunk: KnowledgeChunk) => chunk.chunk_text) ?? [];
  } catch (error) {
    console.error('Knowledge retrieval failed:', error);
    return [];
  }
}

// ============================================================
// System Prompt Builder
// ============================================================

function buildSystemPrompt(
  assistant: AIAssistant,
  context?: AIChatRequest["context"],
  knowledgeContext?: string[],
): string {
  const parts = [
    assistant.system_prompt || `You are an intelligent AI assistant for ${assistant.name}.`,
    "Be helpful, accurate, and professional. Use markdown formatting when appropriate.",
    "Never make up information - if you don't know something, say so clearly.",
    "Maintain organization confidentiality and data privacy at all times.",
  ];

  // Add role-specific context
  if (context?.role) {
    const roleContext = getRoleSystemContext(context.role);
    parts.push(`\n${roleContext}`);
  }

  // Add user information
  if (context?.fullName) {
    parts.push(`\nThe user's name is: ${context.fullName}.`);
  }
  if (context?.department) {
    parts.push(`Department: ${context.department}.`);
  }
  if (context?.currentModule) {
    parts.push(`They are currently in the ${context.currentModule} module.`);
  }

  // Add knowledge context
  if (knowledgeContext && knowledgeContext.length > 0) {
    parts.push(`\nRelevant knowledge from your organization:\n${knowledgeContext.map(k => `- ${k}`).join('\n')}`);
  }

  // Add assistant type specific instructions
  const assistantInstructions = getAssistantTypeInstructions(assistant.assistant_type);
  if (assistantInstructions) {
    parts.push(`\n${assistantInstructions}`);
  }

  return parts.join('\n');
}

function getRoleSystemContext(role?: string): string {
  const rolePrompts: Record<string, string> = {
    admin: [
      "You are assisting an ADMIN user who manages the entire organization.",
      "They handle team oversight, payroll, policies, onboarding/offboarding, leave management, budgets, and company-wide operations.",
      "Focus on organizational health, team utilization, approvals, compliance, and strategic decision support.",
    ].join('\n'),

    manager: [
      "You are assisting a MANAGER who leads a team or department.",
      "They handle project oversight, team workload balancing, sprint planning, client communication, and task delegation.",
      "Focus on team productivity, project status, blockers, deadline tracking, and client-facing updates.",
    ].join('\n'),

    employee: [
      "You are assisting a general EMPLOYEE in the workspace.",
      "They handle their own tasks, time tracking, leave requests, and general workspace queries.",
      "Focus on personal productivity, task management, finding information, and workspace navigation.",
    ].join('\n'),
  };

  return rolePrompts[role ?? "employee"] ?? rolePrompts.employee;
}

function getAssistantTypeInstructions(assistantType: string): string {
  const instructions: Record<string, string> = {
    internal_workspace: [
      "This is an internal workspace assistant for employees.",
      "Focus on helping with internal processes, tasks, and company information.",
      "Maintain professional tone and follow company guidelines.",
    ].join('\n'),

    website_chat: [
      "This is a website chat assistant for visitors and potential clients.",
      "Be welcoming, helpful, and professional.",
      "Focus on answering questions about services, products, and company information.",
      "Guide visitors toward appropriate actions (contact, demo request, etc.).",
    ].join('\n'),

    whatsapp_support: [
      "This is a WhatsApp support assistant.",
      "Be concise and mobile-friendly in responses.",
      "Focus on quick, helpful answers and clear next steps.",
      "Use appropriate emojis and friendly tone when suitable.",
    ].join('\n'),

    admin_command_center: [
      "This is an admin command center assistant for system administrators.",
      "Focus on system operations, monitoring, and administrative tasks.",
      "Provide technical guidance and troubleshooting assistance.",
      "Maintain security awareness and best practices.",
    ].join('\n'),

    client_company_assistant: [
      "This is a dedicated assistant for external client companies.",
      "Focus on client-specific information, project updates, and support.",
      "Maintain professional client service standards.",
      "Respect client confidentiality and business relationships.",
    ].join('\n'),
  };

  return instructions[assistantType] ?? "";
}

// ============================================================
// Conversation Management
// ============================================================

async function getOrCreateConversation(
  supabase: ReturnType<typeof getSupabaseClient>,
  params: {
    organizationId: string;
    userId?: string;
    customerId?: string;
    assistantId?: string;
    channel: string;
    title: string;
  },
): Promise<string> {
  // Create new conversation
  const { data, error } = await supabase
    .from('ai_conversations')
    .insert({
      organization_id: params.organizationId,
      user_id: params.userId || null,
      customer_id: params.customerId || null,
      assistant_id: params.assistantId || null,
      channel: params.channel,
      title: params.title,
      status: 'active',
      metadata: {},
    } as Record<string, unknown>)
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`Failed to create conversation: ${error?.message}`);
  }

  return (data as { id: string }).id;
}

async function saveMessage(
  supabase: ReturnType<typeof getSupabaseClient>,
  params: {
    conversationId: string;
    organizationId: string;
    senderType: 'employee' | 'customer' | 'ai';
    senderId?: string;
    content: string;
    role: 'user' | 'assistant' | 'system';
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await supabase
    .from('ai_messages')
    .insert({
      conversation_id: params.conversationId,
      organization_id: params.organizationId,
      sender_type: params.senderType,
      sender_id: params.senderId || null,
      content: params.content,
      role: params.role,
      metadata: params.metadata || {},
    } as Record<string, unknown>);

  if (error) {
    console.error('Failed to save message:', error);
    // Don't throw - message saving shouldn't break the response
  }
}

// ============================================================
// Audit Logging
// ============================================================

async function logAIActivity(
  supabase: ReturnType<typeof getSupabaseClient>,
  params: {
    organizationId: string;
    actorId?: string;
    actorType: 'employee' | 'customer' | 'ai' | 'system';
    eventType: string;
    referenceType?: string;
    referenceId?: string;
    payload: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await (supabase.rpc as any)('log_ai_activity', {
      p_organization_id: params.organizationId,
      p_actor_id: params.actorId || null,
      p_actor_type: params.actorType,
      p_event_type: params.eventType,
      p_reference_type: params.referenceType || null,
      p_reference_id: params.referenceId || null,
      p_payload: params.payload,
    });
  } catch (error) {
    console.error('Failed to log AI activity:', error);
    // Don't throw - logging shouldn't break the response
  }
}

// ============================================================
// Main Request Handler
// ============================================================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = (await req.json().catch(() => ({}))) as AIChatRequest;

    if (!body.message) {
      return jsonResponse({ error: "Message is required" }, 400);
    }

    if (!body.context?.organizationId) {
      return jsonResponse({ error: "Organization ID is required" }, 400);
    }

    const supabase = getSupabaseClient();
    const { organizationId } = body.context;

    // Step 1: Load assistant configuration
    let assistant: AIAssistant | null = null;
    if (body.assistantId) {
      const { data, error } = await supabase
        .from('ai_assistants')
        .select('*')
        .eq('id', body.assistantId)
        .eq('organization_id', organizationId)
        .eq('enabled', true)
        .single();

      if (error || !data) {
        return jsonResponse({ error: "Assistant not found or disabled" }, 404);
      }
      assistant = data as AIAssistant;
    } else {
      // Default to internal workspace assistant
      const { data, error } = await supabase
        .from('ai_assistants')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('assistant_type', 'internal_workspace')
        .eq('enabled', true)
        .single();

      if (error || !data) {
        return jsonResponse({ error: "No suitable assistant found" }, 404);
      }
      assistant = data as AIAssistant;
    }

    // Step 2: Load user role and permissions
    let userRole = 'employee';
    if (body.context.userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('primary_role')
        .eq('id', body.context.userId)
        .single();
      
      if (profile) {
        userRole = (profile as { primary_role?: string }).primary_role || 'employee';
      }
    }

    // Step 3: Retrieve relevant knowledge
    const knowledgeContext = await retrieveRelevantKnowledge(
      supabase,
      organizationId,
      body.message,
    );

    // Step 4: Build AI context and call OpenAI
    const systemPrompt = buildSystemPrompt(
      assistant!,
      { ...body.context, role: userRole },
      knowledgeContext,
    );

    const aiResponse = await callOpenAI(systemPrompt, body.message);

    // Step 5: Get or create conversation
    const conversationId = await getOrCreateConversation(supabase, {
      organizationId,
      userId: body.context.userId,
      customerId: body.customerId,
      assistantId: assistant!.id,
      channel: body.channel,
      title: body.message.slice(0, 100),
    });

    // Step 6: Save messages
    await saveMessage(supabase, {
      conversationId,
      organizationId,
      senderType: body.context.userId ? 'employee' : 'customer',
      senderId: body.context.userId || body.customerId,
      content: body.message,
      role: 'user',
    });

    await saveMessage(supabase, {
      conversationId,
      organizationId,
      senderType: 'ai',
      content: aiResponse,
      role: 'assistant',
      metadata: {
        model: 'gpt-4o',
        assistant_id: assistant!.id,
        knowledge_sources_used: knowledgeContext.length,
      },
    });

    // Step 7: Log activity
    await logAIActivity(supabase, {
      organizationId,
      actorId: body.context.userId,
      actorType: body.context.userId ? 'employee' : 'customer',
      eventType: 'ai_chat_message',
      referenceType: 'conversation',
      referenceId: conversationId,
      payload: {
        message_length: body.message.length,
        response_length: aiResponse.length,
        assistant_type: assistant!.assistant_type,
        channel: body.channel,
      },
    });

    return jsonResponse({
      success: true,
      conversationId,
      assistantId: assistant!.id,
      assistantName: assistant!.name,
      assistantType: assistant!.assistant_type,
      message: aiResponse,
      metadata: {
        model: 'gpt-4o',
        knowledge_sources_used: knowledgeContext.length,
        organization_context: true,
      },
    });

  } catch (error) {
    console.error('AI Chat error:', error);
    const message = error instanceof Error ? error.message : "Unknown error occurred.";
    
    return jsonResponse({
      success: false,
      error: message,
    }, 500);
  }
});
