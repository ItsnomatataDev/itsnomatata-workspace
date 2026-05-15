import { supabase } from "../../../lib/supabase/client";
import { OFFICE_SLUGS } from "../../../lib/offices";
import { getCompanyOfficeBySlug } from "../../../lib/supabase/queries/offices";
import { createNotification } from "../../../lib/supabase/mutations/notifications";

export type ContentReviewStatus =
  | "draft"
  | "ready_for_review"
  | "sent_to_client"
  | "viewed"
  | "changes_requested"
  | "approved"
  | "published"
  | "archived";

export type ContentReviewLayout =
  | "split_media_text"
  | "article"
  | "gallery"
  | "event_announcement"
  | "campaign_preview"
  | "testimonial"
  | "media_showcase";

export type ContentReviewDraft = {
  id: string;
  organization_id: string;
  office_id: string;
  client_id?: string | null;
  created_by: string | null;
  assigned_to: string | null;
  title: string;
  subtitle: string | null;
  body: string | null;
  summary: string | null;
  captions: string | null;
  notes: string | null;
  layout_type: ContentReviewLayout;
  cta_label: string | null;
  cta_url: string | null;
  review_token: string;
  review_url: string | null;
  slug?: string | null;
  review_status?: ContentReviewStatus | null;
  status: ContentReviewStatus;
  scheduled_at: string | null;
  expires_at: string | null;
  approved_at: string | null;
  approved_by_name: string | null;
  approved_by_email: string | null;
  changes_requested_at: string | null;
  last_viewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ContentReviewAsset = {
  id: string;
  draft_id: string;
  organization_id?: string;
  office_id?: string;
  file_name: string;
  file_url: string;
  storage_path: string | null;
  mime_type: string | null;
  asset_type: string;
  caption: string | null;
  sort_order: number;
  created_at: string;
};

export type ContentReviewComment = {
  id: string;
  draft_id: string;
  client_id?: string | null;
  author_name: string;
  author_email: string | null;
  author_company: string | null;
  body: string;
  source: string;
  client_visible: boolean;
  visibility?: "internal" | "client_visible";
  author_type?: "internal" | "client";
  comment_type?: "internal_comment" | "client_comment" | "change_request" | "approval_note";
  created_at: string;
};

export type ContentClient = {
  id: string;
  organization_id: string;
  office_id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  portal_token: string;
  pin_last_generated_at: string;
  pin_expires_at: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ContentClientPortalSession = {
  sessionToken: string;
  email: string;
  client: Pick<ContentClient, "id" | "company_name" | "contact_name" | "email" | "portal_token">;
};

export type ContentPortalDraftCard = {
  id: string;
  title: string;
  summary: string | null;
  status: ContentReviewStatus;
  scheduled_at: string | null;
  last_viewed_at: string | null;
  approved_at: string | null;
  thumbnail_url: string | null;
};

export type ContentReviewActivity = {
  id: string;
  draft_id: string;
  actor_name: string | null;
  actor_email: string | null;
  actor_user_id?: string | null;
  activity_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type ContentReviewDetail = {
  draft: ContentReviewDraft;
  assets: ContentReviewAsset[];
  comments: ContentReviewComment[];
  activity: ContentReviewActivity[];
};

const BUCKET = "content-review-assets";

export function generateReviewToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function buildReviewUrl(token: string) {
  return `${window.location.origin}/client-review/${token}`;
}

export function buildClientPortalUrl(token: string) {
  return `${window.location.origin}/client-portal/${token}`;
}

export function inferLayoutType(params: {
  assets: Array<{ mime_type?: string | null }>;
  body?: string | null;
}): ContentReviewLayout {
  const hasVideo = params.assets.some((asset) =>
    String(asset.mime_type ?? "").startsWith("video/"),
  );
  if (params.assets.length === 1 && params.body?.trim()) return "split_media_text";
  if (hasVideo) return "media_showcase";
  if (params.assets.length >= 3) return "gallery";
  if (params.body && params.assets.length > 0) return "article";
  return "article";
}

export async function getItsNoMatataOffice(organizationId: string) {
  const office = await getCompanyOfficeBySlug({
    organizationId,
    slug: OFFICE_SLUGS.itsNoMatata,
  });
  if (!office) throw new Error("IT's No Matata office was not found.");
  return office;
}

export async function assertCanUseContentStudio(params: {
  organizationId: string;
  officeId?: string | null;
  role?: string | null;
}) {
  if (!["admin", "social_media", "media_team"].includes(String(params.role ?? ""))) {
    throw new Error("You do not have access to Content Studio.");
  }

  const office = await getItsNoMatataOffice(params.organizationId);
  if (params.officeId !== office.id) {
    throw new Error("Content Studio is only available for IT's No Matata.");
  }

  return office;
}

export async function listContentReviewDrafts(params: {
  organizationId: string;
  officeId: string;
  status?: ContentReviewStatus | "all";
  clientId?: string;
}) {
  let query = supabase
    .from("content_review_drafts")
    .select("*")
    .eq("organization_id", params.organizationId)
    .eq("office_id", params.officeId)
    .order("created_at", { ascending: false });

  if (params.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }
  if (params.clientId) {
    query = query.eq("client_id", params.clientId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ContentReviewDraft[];
}

export async function getContentReviewDetail(params: {
  organizationId: string;
  officeId: string;
  draftId: string;
}): Promise<ContentReviewDetail> {
  const [draftResult, assetsResult, commentsResult, activityResult] =
    await Promise.all([
      supabase
        .from("content_review_drafts")
        .select("*")
        .eq("organization_id", params.organizationId)
        .eq("office_id", params.officeId)
        .eq("id", params.draftId)
        .single(),
      supabase
        .from("content_review_assets")
        .select("*")
        .eq("draft_id", params.draftId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("content_review_comments")
        .select("*")
        .eq("draft_id", params.draftId)
        .order("created_at", { ascending: true }),
      supabase
        .from("content_review_activity")
        .select("*")
        .eq("draft_id", params.draftId)
        .order("created_at", { ascending: false }),
    ]);

  if (draftResult.error) throw draftResult.error;
  if (assetsResult.error) throw assetsResult.error;
  if (commentsResult.error) throw commentsResult.error;
  if (activityResult.error) throw activityResult.error;

  return {
    draft: draftResult.data as ContentReviewDraft,
    assets: (assetsResult.data ?? []) as ContentReviewAsset[],
    comments: (commentsResult.data ?? []) as ContentReviewComment[],
    activity: (activityResult.data ?? []) as ContentReviewActivity[],
  };
}

export async function createContentReviewDraft(params: {
  organizationId: string;
  officeId: string;
  createdBy: string;
  title: string;
  clientId?: string | null;
}) {
  const token = generateReviewToken();
  const { data, error } = await supabase
    .from("content_review_drafts")
    .insert({
      organization_id: params.organizationId,
      office_id: params.officeId,
      created_by: params.createdBy,
      client_id: params.clientId ?? null,
      title: params.title.trim() || "Untitled review",
      review_token: token,
      review_url: buildReviewUrl(token),
      status: "draft",
      expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
    })
    .select("*")
    .single();

  if (error) throw error;
  await recordActivity({
    draft: data as ContentReviewDraft,
    type: "draft_created",
    actorUserId: params.createdBy,
  });
  return data as ContentReviewDraft;
}

export async function listContentClients(params: {
  organizationId: string;
  officeId: string;
}) {
  const { data, error } = await supabase
    .from("content_clients")
    .select("*")
    .eq("organization_id", params.organizationId)
    .eq("office_id", params.officeId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ContentClient[];
}

export async function getContentClient(params: {
  organizationId: string;
  officeId: string;
  clientId: string;
}) {
  const { data, error } = await supabase
    .from("content_clients")
    .select("*")
    .eq("organization_id", params.organizationId)
    .eq("office_id", params.officeId)
    .eq("id", params.clientId)
    .single();

  if (error) throw error;
  return data as ContentClient;
}

export async function createContentClient(params: {
  organizationId: string;
  officeId: string;
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
}) {
  const { data, error } = await supabase.rpc("create_content_client", {
    target_organization_id: params.organizationId,
    target_office_id: params.officeId,
    target_company_name: params.companyName,
    target_contact_name: params.contactName,
    target_email: params.email,
    target_phone: params.phone ?? "",
    target_pin_expires_at: null,
  });
  if (error) throw error;
  return data as { ok: boolean; pin: string; client: ContentClient };
}

export async function regenerateContentClientPin(clientId: string) {
  const { data, error } = await supabase.rpc("regenerate_content_client_pin", {
    target_client_id: clientId,
    target_pin_expires_at: null,
  });
  if (error) throw error;
  return data as { ok: boolean; pin: string; client: ContentClient };
}

export async function updateContentReviewDraft(
  draft: ContentReviewDraft,
  updates: Partial<ContentReviewDraft>,
) {
  const { data, error } = await supabase
    .from("content_review_drafts")
    .update(updates)
    .eq("id", draft.id)
    .select("*")
    .single();

  if (error) throw error;
  return data as ContentReviewDraft;
}

export async function uploadContentReviewAsset(params: {
  draft: ContentReviewDraft;
  file: File;
  uploadedBy: string;
  sortOrder: number;
}) {
  const safeName = params.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${params.draft.organization_id}/${params.draft.id}/${Date.now()}-${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, params.file, {
      contentType: params.file.type || undefined,
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const { data, error } = await supabase
    .from("content_review_assets")
    .insert({
      draft_id: params.draft.id,
      organization_id: params.draft.organization_id,
      office_id: params.draft.office_id,
      uploaded_by: params.uploadedBy,
      file_name: params.file.name,
      file_url: publicUrl.publicUrl,
      storage_path: path,
      mime_type: params.file.type || null,
      asset_type: params.file.type.startsWith("video/") ? "video" : "image",
      sort_order: params.sortOrder,
    })
    .select("*")
    .single();

  if (error) throw error;
  await recordActivity({
    draft: params.draft,
    type: "media_uploaded",
    actorUserId: params.uploadedBy,
    metadata: { fileName: params.file.name },
  });
  return data as ContentReviewAsset;
}

export async function addInternalContentReviewComment(params: {
  draft: ContentReviewDraft;
  body: string;
  createdBy: string;
  authorName: string;
  authorEmail?: string | null;
}) {
  const { data, error } = await supabase
    .from("content_review_comments")
    .insert({
      draft_id: params.draft.id,
      organization_id: params.draft.organization_id,
      office_id: params.draft.office_id,
      author_name: params.authorName,
      author_email: params.authorEmail ?? null,
      body: params.body.trim(),
      comment: params.body.trim(),
      source: "internal",
      client_visible: false,
      visibility: "internal",
      author_type: "internal",
      comment_type: "internal_comment",
      created_by: params.createdBy,
    })
    .select("*")
    .single();

  if (error) throw error;
  await recordActivity({
    draft: params.draft,
    type: "internal_comment_added",
    actorUserId: params.createdBy,
  });
  return data as ContentReviewComment;
}

export async function recordActivity(params: {
  draft: Pick<ContentReviewDraft, "id" | "organization_id" | "office_id">;
  type: string;
  actorUserId?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await supabase.from("content_review_activity").insert({
    draft_id: params.draft.id,
    organization_id: params.draft.organization_id,
    office_id: params.draft.office_id,
    actor_user_id: params.actorUserId ?? null,
    actor_name: params.actorName ?? null,
    actor_email: params.actorEmail ?? null,
    activity_type: params.type,
    metadata: params.metadata ?? {},
  });
  if (error) throw error;
}

async function getInternalRecipients(organizationId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, office:company_offices!profiles_office_id_fkey(slug)")
    .eq("organization_id", organizationId)
    .in("primary_role", ["admin", "social_media", "media_team"]);
  if (error) throw error;
  return (data ?? [])
    .filter((item) => {
      const office = Array.isArray(item.office) ? item.office[0] : item.office;
      return office?.slug === OFFICE_SLUGS.itsNoMatata;
    })
    .map((item) => item.id as string);
}

export async function notifyContentReviewTeam(params: {
  draft: ContentReviewDraft;
  title: string;
  message: string;
  priority?: "low" | "medium" | "high";
  dedupeKey?: string;
}) {
  try {
    const recipients = await getInternalRecipients(params.draft.organization_id);
    const results = await Promise.allSettled(
      recipients.map((userId) =>
        createNotification({
          organizationId: params.draft.organization_id,
          userId,
          type: "system_alert",
          title: params.title,
          message: params.message,
          entityType: "content_review_draft",
          entityId: params.draft.id,
          actionUrl: "/admin/content-studio/reviews",
          priority: params.priority ?? "medium",
          category: "content_review",
          dedupeKey: params.dedupeKey ? `${params.dedupeKey}:${userId}` : undefined,
        }),
      ),
    );
    const failed = results.filter((result) => result.status === "rejected").length;
    if (failed > 0) {
      console.warn(`Content review notification delivery skipped for ${failed} recipient(s).`);
    }
  } catch (error) {
    console.warn("Content review notification delivery skipped.", error);
  }
}

export async function getPublicContentReview(token: string, viewerEmail = "") {
  const { data, error } = await supabase.rpc("get_content_review_by_token", {
    target_token: token,
    viewer_email: viewerEmail,
  });
  if (error) throw error;
  return data as {
    ok: boolean;
    error?: "not_found" | "expired";
    draft?: ContentReviewDraft;
    assets?: ContentReviewAsset[];
    comments?: ContentReviewComment[];
  };
}

export async function submitPublicContentReviewFeedback(params: {
  token: string;
  name: string;
  email: string;
  company?: string;
  comment: string;
  decision: "comment" | "approved" | "changes_requested";
}) {
  const { data, error } = await supabase.rpc("submit_content_review_feedback", {
    target_token: params.token,
    client_name: params.name,
    client_email: params.email,
    client_company: params.company ?? "",
    feedback_body: params.comment,
    decision: params.decision,
  });
  if (error) throw error;
  return data as { ok: boolean; error?: string; status?: ContentReviewStatus };
}

export async function loginContentClientPortal(params: {
  clientToken: string;
  email: string;
  pin: string;
}) {
  const { data, error } = await supabase.rpc("login_content_client_portal", {
    client_token: params.clientToken,
    login_email: params.email,
    raw_pin: params.pin,
  });
  if (error) throw error;
  return data as {
    ok: boolean;
    error?: "invalid_login" | "pin_expired";
    session_token?: string;
    client?: ContentClientPortalSession["client"];
  };
}

export async function getContentClientPortal(params: {
  clientToken: string;
  sessionToken: string;
  email: string;
}) {
  const { data, error } = await supabase.rpc("get_content_client_portal", {
    client_token: params.clientToken,
    session_token: params.sessionToken,
    login_email: params.email,
  });
  if (error) throw error;
  return data as {
    ok: boolean;
    error?: string;
    client?: ContentClientPortalSession["client"];
    drafts?: ContentPortalDraftCard[];
  };
}

export async function getContentClientReview(params: {
  clientToken: string;
  sessionToken: string;
  email: string;
  draftId: string;
}) {
  const { data, error } = await supabase.rpc("get_content_client_review", {
    client_token: params.clientToken,
    session_token: params.sessionToken,
    login_email: params.email,
    target_draft_id: params.draftId,
  });
  if (error) throw error;
  return data as {
    ok: boolean;
    error?: string;
    client?: ContentClientPortalSession["client"];
    draft?: ContentReviewDraft;
    assets?: ContentReviewAsset[];
    comments?: ContentReviewComment[];
  };
}

export async function submitContentClientReviewFeedback(params: {
  clientToken: string;
  sessionToken: string;
  email: string;
  draftId: string;
  comment: string;
  decision: "comment" | "approved" | "changes_requested";
}) {
  const { data, error } = await supabase.rpc("submit_content_client_review_feedback", {
    client_token: params.clientToken,
    session_token: params.sessionToken,
    login_email: params.email,
    target_draft_id: params.draftId,
    feedback_body: params.comment,
    decision: params.decision,
  });
  if (error) throw error;
  return data as { ok: boolean; error?: string; status?: ContentReviewStatus };
}
