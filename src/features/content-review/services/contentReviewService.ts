import { supabase } from "../../../lib/supabase/client";
import { OFFICE_SLUGS } from "../../../lib/offices";
import { getCompanyOfficeBySlug } from "../../../lib/supabase/queries/offices";
import { createNotification } from "../../../lib/supabase/mutations/notifications";
import { askAssistant, buildAssistantContext } from "../../../lib/api/ai";
import {
  defaultScheduleTitle,
  draftScheduleMonthKey,
  isLegacyPostSlotDraft,
  scheduleMonthStartIso,
} from "../utils/contentStudioSchedule";
import { scheduleMonthKey } from "../utils/contentStudioTerms";

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
  library_media_id?: string | null;
  file_name: string;
  file_url: string;
  storage_path: string | null;
  mime_type: string | null;
  asset_type: string;
  heading?: string | null;
  caption: string | null;
  is_selected?: boolean | null;
  crop_x?: number | null;
  crop_y?: number | null;
  crop_zoom?: number | null;
  sort_order: number;
  display_slot?: number;
  expires_at?: string | null;
  original_size_bytes?: number | null;
  stored_size_bytes?: number | null;
  compression_status?: "compressed" | "stored_original" | "not_applicable";
  uploaded_by?: string | null;
  created_at: string;
};

export type ContentClientMedia = {
  id: string;
  client_id: string;
  organization_id: string;
  office_id: string;
  uploaded_by: string | null;
  file_name: string;
  file_url: string;
  storage_path: string | null;
  mime_type: string | null;
  asset_type: string;
  label: string | null;
  original_size_bytes?: number | null;
  stored_size_bytes?: number | null;
  compression_status?: "compressed" | "stored_original" | "not_applicable";
  expires_at?: string | null;
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

export type ContentStudioCaptionGenerateInput = {
  clientName: string;
  postTitle: string;
  existingCaption?: string;
  mediaDescription?: string;
  platform?: string;
  tone?: string;
  instruction?: string;
};

export type ContentStudioCaptionGenerateOutput = {
  generatedCaption: string;
  hashtags: string[];
  shortAlternative: string;
};

export type ContentStudioImageAnalysis = {
  mood: string;
  sceneDescription: string;
  generatedCaption: string;
  hashtags: string[];
  shortAlternative: string;
  instagramCaption?: string;
  facebookCaption?: string;
};

const BUCKET = "content-review-assets";
const ASSET_RETENTION_DAYS = 60;
const SCHEDULE_RETENTION_DAYS = 60;
/** Public schedule / client-review links stay open through the full review cycle. */
export const CONTENT_REVIEW_LINK_VALID_DAYS = 90;

export function contentReviewLinkExpiresAt(fromMs = Date.now()) {
  return new Date(fromMs + CONTENT_REVIEW_LINK_VALID_DAYS * 86400000).toISOString();
}

/** Extends link expiry when missing or expiring soon (legacy 14-day drafts). */
export async function refreshContentReviewLinkExpiry(draft: ContentReviewDraft) {
  const minimumValidMs = Date.now() + 30 * 86400000;
  const currentMs = draft.expires_at ? new Date(draft.expires_at).getTime() : 0;
  if (currentMs >= minimumValidMs) return draft;
  return updateContentReviewDraft(draft, {
    expires_at: contentReviewLinkExpiresAt(),
  });
}
const MAINTENANCE_INTERVAL_MS = 5 * 60 * 1000;
let lastContentReviewMaintenanceAt = 0;

/** Runs storage/schedule cleanup at most once every five minutes per browser session. */
export async function runContentReviewMaintenanceIfDue() {
  const now = Date.now();
  if (now - lastContentReviewMaintenanceAt < MAINTENANCE_INTERVAL_MS) return;
  lastContentReviewMaintenanceAt = now;
  await cleanupExpiredContentReviewAssets();
  await purgeOldContentReviewSchedules();
}
export const CONTENT_REVIEW_UPLOAD_LIMIT_BYTES = 1024 * 1024 * 1024;
const VIDEO_TARGET_BITS_PER_SECOND = 2_500_000;
const AUDIO_TARGET_BITS_PER_SECOND = 128_000;

type CapturableVideoElement = HTMLVideoElement & {
  captureStream?: () => MediaStream;
  mozCaptureStream?: () => MediaStream;
};

export function formatContentReviewFileSize(bytes: number) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  return `${Math.ceil(bytes / (1024 * 1024))} MB`;
}

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

export async function purgeOldContentReviewSchedules(
  retentionDays = SCHEDULE_RETENTION_DAYS,
) {
  const { data, error } = await supabase.rpc("purge_content_review_schedules", {
    retention_days: retentionDays,
  });
  if (error) {
    console.warn("Content review schedule purge skipped.", error.message);
    return { ok: false, deleted: 0 };
  }
  return (data ?? { ok: true, deleted: 0 }) as { ok: boolean; deleted: number };
}

export async function listContentReviewDrafts(
  params: {
    organizationId: string;
    officeId: string;
    status?: ContentReviewStatus | "all";
    clientId?: string;
  },
  options?: { skipMaintenance?: boolean },
) {
  if (!options?.skipMaintenance) {
    await runContentReviewMaintenanceIfDue();
  }

  const retentionCutoff = new Date(
    Date.now() - SCHEDULE_RETENTION_DAYS * 86400000,
  ).toISOString();

  let query = supabase
    .from("content_review_drafts")
    .select("*")
    .eq("organization_id", params.organizationId)
    .eq("office_id", params.officeId)
    .gte("created_at", retentionCutoff)
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

export async function listContentReviewAssetsForDrafts(params: {
  organizationId: string;
  officeId: string;
  draftIds: string[];
}) {
  if (params.draftIds.length === 0) return [] as ContentReviewAsset[];

  const expiresCutoff = new Date().toISOString();
  const { data, error } = await supabase
    .from("content_review_assets")
    .select("*")
    .eq("organization_id", params.organizationId)
    .eq("office_id", params.officeId)
    .in("draft_id", params.draftIds)
    .gte("expires_at", expiresCutoff)
    .order("display_slot", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ContentReviewAsset[];
}

/** Lightweight detail map for dashboards (draft + assets only, no comments/activity). */
export function buildContentReviewDetailsIndex(
  drafts: ContentReviewDraft[],
  assets: ContentReviewAsset[],
): Record<string, ContentReviewDetail> {
  const assetsByDraftId = new Map<string, ContentReviewAsset[]>();
  for (const asset of assets) {
    const bucket = assetsByDraftId.get(asset.draft_id) ?? [];
    bucket.push(asset);
    assetsByDraftId.set(asset.draft_id, bucket);
  }

  const index: Record<string, ContentReviewDetail> = {};
  for (const draft of drafts) {
    index[draft.id] = {
      draft,
      assets: assetsByDraftId.get(draft.id) ?? [],
      comments: [],
      activity: [],
    };
  }
  return index;
}

export async function loadContentStudioClientSnapshot(params: {
  organizationId: string;
  officeId: string;
  clientId: string;
}) {
  const clientDrafts = await listContentReviewDrafts(
    {
      organizationId: params.organizationId,
      officeId: params.officeId,
      clientId: params.clientId,
    },
    { skipMaintenance: true },
  );
  const assets = await listContentReviewAssetsForDrafts({
    organizationId: params.organizationId,
    officeId: params.officeId,
    draftIds: clientDrafts.map((draft) => draft.id),
  });
  return {
    clientDrafts,
    detailsByDraftId: buildContentReviewDetailsIndex(clientDrafts, assets),
  };
}

export async function getContentReviewDetail(params: {
  organizationId: string;
  officeId: string;
  draftId: string;
}): Promise<ContentReviewDetail> {
  await runContentReviewMaintenanceIfDue();
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
        .gte("expires_at", new Date().toISOString())
        .order("display_slot", { ascending: true })
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
      expires_at: contentReviewLinkExpiresAt(),
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

/** @deprecated Use ensureClientMonthlySchedule */
export async function ensureClientPostSlots(params: {
  organizationId: string;
  officeId: string;
  clientId: string;
  createdBy: string;
  expectedCount?: number;
}) {
  const schedule = await ensureClientMonthlySchedule({
    organizationId: params.organizationId,
    officeId: params.officeId,
    clientId: params.clientId,
    createdBy: params.createdBy,
  });
  return [schedule];
}

export async function ensureClientMonthlySchedule(params: {
  organizationId: string;
  officeId: string;
  clientId: string;
  createdBy: string;
  monthKey?: string;
}) {
  const monthKey = params.monthKey ?? scheduleMonthKey();

  const existing = await listContentReviewDrafts(
    {
      organizationId: params.organizationId,
      officeId: params.officeId,
      clientId: params.clientId,
    },
    { skipMaintenance: true },
  );

  const legacy = existing.filter((draft) => isLegacyPostSlotDraft(draft));
  const nonLegacy = existing.filter((draft) => !isLegacyPostSlotDraft(draft));

  let schedule =
    nonLegacy.find((draft) => draftScheduleMonthKey(draft) === monthKey) ??
    [...nonLegacy].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0] ??
    null;

  if (!schedule && legacy.length > 0) {
    const primary = [...legacy].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    )[0];
    schedule = await updateContentReviewDraft(primary, {
      title: defaultScheduleTitle(monthKey),
      scheduled_at: primary.scheduled_at ?? scheduleMonthStartIso(monthKey),
    });
  }

  if (!schedule) {
    const created = await createContentReviewDraft({
      organizationId: params.organizationId,
      officeId: params.officeId,
      createdBy: params.createdBy,
      clientId: params.clientId,
      title: defaultScheduleTitle(monthKey),
    });
    schedule = await updateContentReviewDraft(created, {
      scheduled_at: scheduleMonthStartIso(monthKey),
    });
  } else if (!schedule.scheduled_at) {
    schedule = await updateContentReviewDraft(schedule, {
      scheduled_at: scheduleMonthStartIso(monthKey),
      title: schedule.title?.trim() ? schedule.title : defaultScheduleTitle(monthKey),
    });
  }

  // Only remove duplicate legacy "Post N" slot rows — never delete other assigned schedules.
  const deleteTargets = legacy.filter((draft) => draft.id !== schedule.id);

  for (const draft of deleteTargets) {
    try {
      await deleteContentReviewDraft(draft.id);
    } catch (err) {
      console.warn("Failed to remove legacy content studio draft", draft.id, err);
    }
  }

  return refreshContentReviewLinkExpiry(schedule);
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

/** Rotates the per-post public preview token. Old `/client-review/:token` URLs stop working. No PIN required on the new link. */
export async function regenerateContentReviewLink(draft: ContentReviewDraft) {
  const token = generateReviewToken();
  const updated = await updateContentReviewDraft(draft, {
    review_token: token,
    review_url: buildReviewUrl(token),
    expires_at: contentReviewLinkExpiresAt(),
  });
  await recordActivity({
    draft: updated,
    type: "review_link_regenerated",
    metadata: { access: "public_preview" },
  });
  return updated;
}

export async function deleteContentClient(clientId: string) {
  const { data: assets, error: assetsError } = await supabase
    .from("content_review_assets")
    .select("storage_path, library_media_id, draft:content_review_drafts!inner(client_id)")
    .eq("draft.client_id", clientId);
  if (assetsError) {
    throw new Error(assetsError.message || "Failed to load client media for deletion.");
  }

  const { data: libraryMedia, error: libraryError } = await supabase
    .from("content_client_media")
    .select("storage_path")
    .eq("client_id", clientId);
  if (libraryError) {
    throw new Error(libraryError.message || "Failed to load client library media for deletion.");
  }

  await removeStoragePaths(
    [
      ...(assets ?? [])
        .filter((asset) => !asset.library_media_id)
        .map((asset) => asset.storage_path as string | null),
      ...(libraryMedia ?? []).map((item) => item.storage_path as string | null),
    ].filter((path): path is string => Boolean(path)),
  );

  const { data, error } = await supabase.rpc("delete_content_client", {
    target_client_id: clientId,
  });
  if (error) {
    const rpcMissing =
      error.code === "PGRST202" ||
      error.message?.toLowerCase().includes("could not find the function") ||
      error.message?.toLowerCase().includes("schema cache");
    if (!rpcMissing) {
      throw new Error(error.message || "Failed to delete client.");
    }
    return deleteContentClientDirect(clientId);
  }
  const result = data as { ok: boolean; error?: string };
  if (!result.ok) {
    throw new Error(
      result.error === "forbidden"
        ? "You do not have access to delete this client."
        : "Client could not be deleted.",
    );
  }
  return result;
}

async function deleteContentClientDirect(clientId: string) {
  const { error: draftsError } = await supabase
    .from("content_review_drafts")
    .delete()
    .eq("client_id", clientId);
  if (draftsError) {
    throw new Error(draftsError.message || "Failed to delete client drafts.");
  }

  const { error: clientError } = await supabase
    .from("content_clients")
    .delete()
    .eq("id", clientId);
  if (clientError) {
    throw new Error(clientError.message || "Failed to delete client.");
  }

  return { ok: true };
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

export async function updateContentReviewAsset(
  assetId: string,
  updates: Pick<
    Partial<ContentReviewAsset>,
    | "heading"
    | "caption"
    | "is_selected"
    | "sort_order"
    | "display_slot"
    | "crop_x"
    | "crop_y"
    | "crop_zoom"
  >,
) {
  const { data, error } = await supabase
    .from("content_review_assets")
    .update(updates)
    .eq("id", assetId)
    .select("*")
    .single();

  if (error) throw error;
  return data as ContentReviewAsset;
}

export async function setContentReviewAssetsSelected(assetIds: string[], isSelected: boolean) {
  if (assetIds.length === 0) return [];

  const { data, error } = await supabase
    .from("content_review_assets")
    .update({ is_selected: isSelected })
    .in("id", assetIds)
    .select("*");

  if (error) throw error;
  return (data ?? []) as ContentReviewAsset[];
}

export async function deleteContentReviewAsset(asset: ContentReviewAsset) {
  if (asset.storage_path && !asset.library_media_id) {
    await removeStoragePaths([asset.storage_path]);
  }

  const { error } = await supabase
    .from("content_review_assets")
    .delete()
    .eq("id", asset.id);

  if (error) {
    throw new Error(error.message || "Failed to delete media.");
  }
}

export async function listContentClientMedia(params: {
  organizationId: string;
  officeId: string;
  clientId: string;
  uploadedBy?: string | null;
  /** Post→library sync is expensive; enable on Media tab or after uploads. */
  syncFromPosts?: boolean;
}) {
  if (params.syncFromPosts) {
    await syncClientMediaFromPostAssets({
      organizationId: params.organizationId,
      officeId: params.officeId,
      clientId: params.clientId,
      uploadedBy: params.uploadedBy ?? null,
    });
  }

  await deduplicateContentClientMediaLibrary({
    organizationId: params.organizationId,
    officeId: params.officeId,
    clientId: params.clientId,
  });

  const { data, error } = await supabase
    .from("content_client_media")
    .select("*")
    .eq("organization_id", params.organizationId)
    .eq("office_id", params.officeId)
    .eq("client_id", params.clientId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ContentClientMedia[];
}

export async function syncClientMediaFromPostAssets(params: {
  organizationId: string;
  officeId: string;
  clientId: string;
  uploadedBy?: string | null;
}) {
  const drafts = await listContentReviewDrafts(
    {
      organizationId: params.organizationId,
      officeId: params.officeId,
      clientId: params.clientId,
    },
    { skipMaintenance: true },
  );
  if (drafts.length === 0) return [];

  const draftIds = drafts.map((draft) => draft.id);
  const { data: assets, error } = await supabase
    .from("content_review_assets")
    .select("*")
    .in("draft_id", draftIds)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const synced: ContentClientMedia[] = [];
  for (const asset of (assets ?? []) as ContentReviewAsset[]) {
    const libraryItem = await registerPostAssetInClientLibrary({
      asset,
      clientId: params.clientId,
      organizationId: params.organizationId,
      officeId: params.officeId,
      uploadedBy: params.uploadedBy ?? asset.uploaded_by ?? null,
    });
    if (libraryItem) synced.push(libraryItem);
  }
  return synced;
}

/** Same bytes/name from library upload vs post upload often land on different storage paths. */
function clientMediaMergeKey(media: {
  file_name: string;
  stored_size_bytes?: number | null;
  mime_type?: string | null;
}) {
  const name = media.file_name.trim().toLowerCase();
  const size = media.stored_size_bytes ?? 0;
  const mime = (media.mime_type ?? "").trim().toLowerCase();
  return `${name}::${size}::${mime}`;
}

async function findExistingClientLibraryMedia(params: {
  clientId: string;
  libraryMediaId?: string | null;
  storagePath?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  storedSizeBytes?: number | null;
  mimeType?: string | null;
}): Promise<ContentClientMedia | null> {
  if (params.libraryMediaId) {
    const { data: linked, error } = await supabase
      .from("content_client_media")
      .select("*")
      .eq("id", params.libraryMediaId)
      .maybeSingle();
    if (error) throw error;
    if (linked) return linked as ContentClientMedia;
  }

  if (params.storagePath) {
    const { data, error } = await supabase
      .from("content_client_media")
      .select("*")
      .eq("client_id", params.clientId)
      .eq("storage_path", params.storagePath)
      .maybeSingle();
    if (error) throw error;
    if (data) return data as ContentClientMedia;
  }

  if (params.fileUrl) {
    const { data, error } = await supabase
      .from("content_client_media")
      .select("*")
      .eq("client_id", params.clientId)
      .eq("file_url", params.fileUrl)
      .maybeSingle();
    if (error) throw error;
    if (data) return data as ContentClientMedia;
  }

  if (params.fileName && params.storedSizeBytes != null) {
    const { data, error } = await supabase
      .from("content_client_media")
      .select("*")
      .eq("client_id", params.clientId)
      .eq("file_name", params.fileName)
      .eq("stored_size_bytes", params.storedSizeBytes);
    if (error) throw error;
    if (data && data.length > 0) return data[0] as ContentClientMedia;
  }

  return null;
}

async function countPostAssetReferences(media: ContentClientMedia) {
  const filters = [
    media.id ? `library_media_id.eq.${media.id}` : null,
    media.storage_path ? `storage_path.eq.${media.storage_path}` : null,
  ].filter(Boolean);

  if (filters.length === 0) return 0;

  const { count, error } = await supabase
    .from("content_review_assets")
    .select("id", { count: "exact", head: true })
    .or(filters.join(","));

  if (error) throw error;
  return count ?? 0;
}

async function pickCanonicalClientLibraryMedia(group: ContentClientMedia[]) {
  const scored = await Promise.all(
    group.map(async (item) => ({
      item,
      refs: await countPostAssetReferences(item),
    })),
  );
  scored.sort((a, b) => {
    if (b.refs !== a.refs) return b.refs - a.refs;
    return new Date(a.item.created_at).getTime() - new Date(b.item.created_at).getTime();
  });
  return scored[0]?.item ?? group[0];
}

/** Merges duplicate library rows (same file synced from posts vs library uploads) and removes orphan storage. */
async function deduplicateContentClientMediaLibrary(params: {
  organizationId: string;
  officeId: string;
  clientId: string;
}) {
  const { data: rows, error } = await supabase
    .from("content_client_media")
    .select("*")
    .eq("organization_id", params.organizationId)
    .eq("office_id", params.officeId)
    .eq("client_id", params.clientId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  if (!rows || rows.length < 2) return;

  const groups = new Map<string, ContentClientMedia[]>();
  for (const row of rows as ContentClientMedia[]) {
    const key = clientMediaMergeKey(row);
    const bucket = groups.get(key) ?? [];
    bucket.push(row);
    groups.set(key, bucket);
  }

  for (const group of groups.values()) {
    if (group.length < 2) continue;

    const canonical = await pickCanonicalClientLibraryMedia(group);
    const duplicates = group.filter((item) => item.id !== canonical.id);

    for (const duplicate of duplicates) {
      await supabase
        .from("content_review_assets")
        .update({ library_media_id: canonical.id })
        .eq("library_media_id", duplicate.id);

      if (duplicate.storage_path && duplicate.storage_path !== canonical.storage_path) {
        const refs = await countPostAssetReferences(duplicate);
        if (refs === 0) {
          await removeStoragePaths([duplicate.storage_path]);
        }
      }

      const { error: deleteError } = await supabase
        .from("content_client_media")
        .delete()
        .eq("id", duplicate.id);
      if (deleteError) throw deleteError;
    }
  }
}

async function linkPostAssetToLibraryMedia(assetId: string, libraryMediaId: string) {
  await supabase
    .from("content_review_assets")
    .update({ library_media_id: libraryMediaId })
    .eq("id", assetId);
}

async function registerPostAssetInClientLibrary(params: {
  asset: ContentReviewAsset;
  clientId: string;
  organizationId: string;
  officeId: string;
  uploadedBy: string | null;
}): Promise<ContentClientMedia | null> {
  if (!params.asset.file_url) return null;

  const existing = await findExistingClientLibraryMedia({
    clientId: params.clientId,
    libraryMediaId: params.asset.library_media_id,
    storagePath: params.asset.storage_path,
    fileUrl: params.asset.file_url,
    fileName: params.asset.file_name,
    storedSizeBytes: params.asset.stored_size_bytes ?? null,
    mimeType: params.asset.mime_type,
  });

  if (existing) {
    if (params.asset.library_media_id !== existing.id) {
      await linkPostAssetToLibraryMedia(params.asset.id, existing.id);
    }
    return existing;
  }

  const { data: created, error: insertError } = await supabase
    .from("content_client_media")
    .insert({
      client_id: params.clientId,
      organization_id: params.organizationId,
      office_id: params.officeId,
      uploaded_by: params.uploadedBy,
      file_name: params.asset.file_name,
      file_url: params.asset.file_url,
      storage_path: params.asset.storage_path,
      mime_type: params.asset.mime_type,
      asset_type: params.asset.asset_type,
      label: "From post",
      expires_at: params.asset.expires_at ?? new Date(Date.now() + ASSET_RETENTION_DAYS * 86400000).toISOString(),
      original_size_bytes: params.asset.original_size_bytes ?? null,
      stored_size_bytes: params.asset.stored_size_bytes ?? null,
      compression_status: params.asset.compression_status ?? "not_applicable",
    })
    .select("*")
    .single();

  if (insertError) throw insertError;

  await linkPostAssetToLibraryMedia(params.asset.id, created.id);
  return created as ContentClientMedia;
}

export async function uploadContentClientMedia(params: {
  client: ContentClient;
  file: File;
  uploadedBy: string;
  label?: string;
}) {
  await cleanupExpiredContentClientMedia();
  const uploadFile = await compressMediaFile(params.file);
  if (uploadFile.file.size > CONTENT_REVIEW_UPLOAD_LIMIT_BYTES) {
    throw new Error(
      `Media is still too large after compression. Please keep uploads under ${formatContentReviewFileSize(CONTENT_REVIEW_UPLOAD_LIMIT_BYTES)}.`,
    );
  }
  const safeName = uploadFile.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${params.client.organization_id}/clients/${params.client.id}/${Date.now()}-${safeName || `asset${fileExtension(uploadFile.file)}`}`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, uploadFile.file, {
      contentType: uploadFile.file.type || undefined,
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(path);

  const existing = await findExistingClientLibraryMedia({
    clientId: params.client.id,
    storagePath: path,
    fileUrl: publicUrl.publicUrl,
    fileName: uploadFile.file.name,
    storedSizeBytes: uploadFile.storedSize,
    mimeType: uploadFile.file.type || null,
  });
  if (existing) {
    if (existing.storage_path !== path) {
      await removeStoragePaths([path]);
    }
    return existing;
  }

  const { data, error } = await supabase
    .from("content_client_media")
    .insert({
      client_id: params.client.id,
      organization_id: params.client.organization_id,
      office_id: params.client.office_id,
      uploaded_by: params.uploadedBy,
      file_name: uploadFile.file.name,
      file_url: publicUrl.publicUrl,
      storage_path: path,
      mime_type: uploadFile.file.type || null,
      asset_type: uploadFile.file.type.startsWith("video/") ? "video" : "image",
      label: params.label?.trim() || null,
      expires_at: new Date(Date.now() + ASSET_RETENTION_DAYS * 86400000).toISOString(),
      original_size_bytes: uploadFile.originalSize,
      stored_size_bytes: uploadFile.storedSize,
      compression_status: uploadFile.compressionStatus,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as ContentClientMedia;
}

export async function deleteContentClientMedia(media: ContentClientMedia) {
  await deduplicateContentClientMediaLibrary({
    organizationId: media.organization_id,
    officeId: media.office_id,
    clientId: media.client_id,
  });

  const { data: allRows, error: siblingsError } = await supabase
    .from("content_client_media")
    .select("*")
    .eq("client_id", media.client_id);

  if (siblingsError) {
    throw new Error(siblingsError.message || "Failed to load duplicate library media.");
  }

  const mergeKey = clientMediaMergeKey(media);
  let targets = ((allRows ?? []) as ContentClientMedia[]).filter(
    (row) => clientMediaMergeKey(row) === mergeKey,
  );
  if (targets.length === 0) {
    targets = [media];
  }

  for (const target of targets) {
    const assetRefCount = await countPostAssetReferences(target);

    await supabase
      .from("content_review_assets")
      .update({ library_media_id: null })
      .eq("library_media_id", target.id);

    if (target.storage_path && assetRefCount === 0) {
      await removeStoragePaths([target.storage_path]);
    }

    const { error } = await supabase.from("content_client_media").delete().eq("id", target.id);
    if (error) {
      throw new Error(error.message || "Failed to delete client media.");
    }
  }
}

export async function attachContentClientMediaToDraft(params: {
  media: ContentClientMedia;
  targetDraft: ContentReviewDraft;
  uploadedBy: string;
  sortOrder: number;
  displaySlot?: number;
}) {
  const { data, error } = await supabase
    .from("content_review_assets")
    .insert({
      draft_id: params.targetDraft.id,
      organization_id: params.targetDraft.organization_id,
      office_id: params.targetDraft.office_id,
      uploaded_by: params.uploadedBy,
      library_media_id: params.media.id,
      file_name: params.media.file_name,
      file_url: params.media.file_url,
      storage_path: params.media.storage_path,
      mime_type: params.media.mime_type,
      asset_type: params.media.asset_type,
      heading: null,
      caption: null,
      is_selected: true,
      crop_x: 50,
      crop_y: 50,
      crop_zoom: 1,
      sort_order: params.sortOrder,
      display_slot: params.displaySlot ?? params.sortOrder,
      expires_at: params.media.expires_at ?? new Date(Date.now() + ASSET_RETENTION_DAYS * 86400000).toISOString(),
      original_size_bytes: params.media.original_size_bytes ?? null,
      stored_size_bytes: params.media.stored_size_bytes ?? null,
      compression_status: params.media.compression_status ?? "not_applicable",
    })
    .select("*")
    .single();

  if (error) throw error;
  await recordActivity({
    draft: params.targetDraft,
    type: "media_uploaded",
    actorUserId: params.uploadedBy,
    metadata: {
      fileName: params.media.file_name,
      source: "client_library",
      libraryMediaId: params.media.id,
    },
  });
  return data as ContentReviewAsset;
}

async function cleanupExpiredContentClientMedia() {
  const { data: expired, error: loadError } = await supabase
    .from("content_client_media")
    .select("id, storage_path")
    .lt("expires_at", new Date().toISOString());
  if (loadError) {
    console.warn("Expired client media cleanup skipped.", loadError.message);
    return;
  }

  await removeStoragePaths(
    (expired ?? [])
      .map((item) => item.storage_path as string | null)
      .filter((path): path is string => Boolean(path)),
  );

  const ids = (expired ?? []).map((item) => item.id as string);
  if (ids.length > 0) {
    const { error: deleteError } = await supabase.from("content_client_media").delete().in("id", ids);
    if (deleteError) {
      console.warn("Expired client media row cleanup skipped.", deleteError.message);
    }
  }
}

function fileExtension(file: File) {
  const namePart = file.name.split(".").pop();
  return namePart ? `.${namePart.toLowerCase()}` : "";
}

async function compressImageFile(file: File) {
  if (!file.type.startsWith("image/")) {
    return {
      file,
      compressionStatus: "not_applicable" as const,
      originalSize: file.size,
      storedSize: file.size,
    };
  }

  if (file.type === "image/gif") {
    return {
      file,
      compressionStatus: "stored_original" as const,
      originalSize: file.size,
      storedSize: file.size,
    };
  }

  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return {
      file,
      compressionStatus: "stored_original" as const,
      originalSize: file.size,
      storedSize: file.size,
    };
  }

  context.drawImage(bitmap, 0, 0);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", 0.92);
  });

  if (!blob || blob.size >= file.size) {
    return {
      file,
      compressionStatus: "stored_original" as const,
      originalSize: file.size,
      storedSize: file.size,
    };
  }

  const compressed = new File(
    [blob],
    `${file.name.replace(/\.[^.]+$/, "")}.webp`,
    { type: "image/webp" },
  );

  return {
    file: compressed,
    compressionStatus: "compressed" as const,
    originalSize: file.size,
    storedSize: compressed.size,
  };
}

async function compressVideoFile(file: File) {
  if (!file.type.startsWith("video/")) {
    return {
      file,
      compressionStatus: "not_applicable" as const,
      originalSize: file.size,
      storedSize: file.size,
    };
  }

  if (!("MediaRecorder" in window) || !MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")) {
    return {
      file,
      compressionStatus: "stored_original" as const,
      originalSize: file.size,
      storedSize: file.size,
    };
  }

  const url = URL.createObjectURL(file);
  const video = document.createElement("video") as CapturableVideoElement;
  video.src = url;
  video.preload = "metadata";
  video.playsInline = true;
  video.volume = 0;

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Video could not be prepared for compression."));
    });

    const captureStream = (video.captureStream ?? video.mozCaptureStream)?.bind(video);
    if (!captureStream) {
      return {
        file,
        compressionStatus: "stored_original" as const,
        originalSize: file.size,
        storedSize: file.size,
      };
    }

    const stream = captureStream();
    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(stream, {
      mimeType: "video/webm;codecs=vp9,opus",
      videoBitsPerSecond: VIDEO_TARGET_BITS_PER_SECOND,
      audioBitsPerSecond: AUDIO_TARGET_BITS_PER_SECOND,
    });

    const blob = await new Promise<Blob>((resolve, reject) => {
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onerror = () => reject(new Error("Video compression failed."));
      recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
      video.onended = () => {
        if (recorder.state !== "inactive") recorder.stop();
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start(1000);
      void video.play().catch((error) => {
        if (recorder.state !== "inactive") recorder.stop();
        stream.getTracks().forEach((track) => track.stop());
        reject(error instanceof Error ? error : new Error("Video compression could not start."));
      });
    });

    if (!blob || blob.size === 0 || blob.size >= file.size) {
      return {
        file,
        compressionStatus: "stored_original" as const,
        originalSize: file.size,
        storedSize: file.size,
      };
    }

    const compressed = new File(
      [blob],
      `${file.name.replace(/\.[^.]+$/, "")}.webm`,
      { type: "video/webm" },
    );

    return {
      file: compressed,
      compressionStatus: "compressed" as const,
      originalSize: file.size,
      storedSize: compressed.size,
    };
  } catch (error) {
    console.warn("Video compression skipped.", error);
    return {
      file,
      compressionStatus: "stored_original" as const,
      originalSize: file.size,
      storedSize: file.size,
    };
  } finally {
    URL.revokeObjectURL(url);
    video.removeAttribute("src");
    video.load();
  }
}

async function compressMediaFile(file: File) {
  if (file.type.startsWith("image/")) return compressImageFile(file);
  if (file.type.startsWith("video/")) return compressVideoFile(file);
  return {
    file,
    compressionStatus: "not_applicable" as const,
    originalSize: file.size,
    storedSize: file.size,
  };
}

async function cleanupExpiredContentReviewAssets() {
  const { data: expiredAssets, error: loadError } = await supabase
    .from("content_review_assets")
    .select("id, storage_path")
    .lt("expires_at", new Date().toISOString());
  if (loadError) {
    console.warn("Expired content review asset cleanup skipped.", loadError.message);
    return;
  }

  await removeStoragePaths(
    (expiredAssets ?? [])
      .map((asset) => asset.storage_path as string | null)
      .filter((path): path is string => Boolean(path)),
  );

  const ids = (expiredAssets ?? []).map((asset) => asset.id as string);
  if (ids.length > 0) {
    const { error: deleteError } = await supabase
      .from("content_review_assets")
      .delete()
      .in("id", ids);
    if (deleteError) {
      console.warn("Expired content review asset row cleanup skipped.", deleteError.message);
    }
  }
}

export async function uploadContentReviewAsset(params: {
  draft: ContentReviewDraft;
  file: File;
  uploadedBy: string;
  sortOrder: number;
  displaySlot?: number;
}) {
  await cleanupExpiredContentReviewAssets();
  const uploadFile = await compressMediaFile(params.file);
  if (uploadFile.file.size > CONTENT_REVIEW_UPLOAD_LIMIT_BYTES) {
    throw new Error(
      `Media is still too large after compression. Please keep uploads under ${formatContentReviewFileSize(CONTENT_REVIEW_UPLOAD_LIMIT_BYTES)}.`,
    );
  }
  const safeName = uploadFile.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${params.draft.organization_id}/${params.draft.id}/${Date.now()}-${safeName || `asset${fileExtension(uploadFile.file)}`}`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, uploadFile.file, {
      contentType: uploadFile.file.type || undefined,
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
      file_name: uploadFile.file.name,
      file_url: publicUrl.publicUrl,
      storage_path: path,
      mime_type: uploadFile.file.type || null,
      asset_type: uploadFile.file.type.startsWith("video/") ? "video" : "image",
      is_selected: true,
      crop_x: 50,
      crop_y: 50,
      crop_zoom: 1,
      sort_order: params.sortOrder,
      display_slot: params.displaySlot ?? params.sortOrder,
      expires_at: new Date(Date.now() + ASSET_RETENTION_DAYS * 86400000).toISOString(),
      original_size_bytes: uploadFile.originalSize,
      stored_size_bytes: uploadFile.storedSize,
      compression_status: uploadFile.compressionStatus,
    })
    .select("*")
    .single();

  if (error) throw error;

  let asset = data as ContentReviewAsset;
  if (params.draft.client_id) {
    try {
      await registerPostAssetInClientLibrary({
        asset,
        clientId: params.draft.client_id,
        organizationId: params.draft.organization_id,
        officeId: params.draft.office_id,
        uploadedBy: params.uploadedBy,
      });
      const { data: refreshed } = await supabase
        .from("content_review_assets")
        .select("*")
        .eq("id", asset.id)
        .single();
      if (refreshed) asset = refreshed as ContentReviewAsset;
    } catch (syncError) {
      console.warn("Post media library sync skipped.", syncError);
    }
  }

  await recordActivity({
    draft: params.draft,
    type: "media_uploaded",
    actorUserId: params.uploadedBy,
    metadata: {
      fileName: params.file.name,
      storedFileName: uploadFile.file.name,
      compressionStatus: uploadFile.compressionStatus,
      originalSizeBytes: uploadFile.originalSize,
      storedSizeBytes: uploadFile.storedSize,
      expiresInDays: ASSET_RETENTION_DAYS,
      librarySynced: Boolean(params.draft.client_id),
    },
  });
  return asset;
}

export async function duplicateContentReviewAssetToDraft(params: {
  sourceAsset: ContentReviewAsset;
  targetDraft: ContentReviewDraft;
  uploadedBy: string;
  sortOrder: number;
}) {
  const { data, error } = await supabase
    .from("content_review_assets")
    .insert({
      draft_id: params.targetDraft.id,
      organization_id: params.targetDraft.organization_id,
      office_id: params.targetDraft.office_id,
      uploaded_by: params.uploadedBy,
      library_media_id: params.sourceAsset.library_media_id ?? null,
      file_name: params.sourceAsset.file_name,
      file_url: params.sourceAsset.file_url,
      storage_path: params.sourceAsset.storage_path,
      mime_type: params.sourceAsset.mime_type,
      asset_type: params.sourceAsset.asset_type,
      heading: params.sourceAsset.heading ?? null,
      caption: params.sourceAsset.caption ?? null,
      is_selected: true,
      crop_x: params.sourceAsset.crop_x ?? 50,
      crop_y: params.sourceAsset.crop_y ?? 50,
      crop_zoom: params.sourceAsset.crop_zoom ?? 1,
      sort_order: params.sortOrder,
      display_slot: params.sortOrder,
      expires_at: params.sourceAsset.expires_at ?? new Date(Date.now() + ASSET_RETENTION_DAYS * 86400000).toISOString(),
      original_size_bytes: params.sourceAsset.original_size_bytes ?? null,
      stored_size_bytes: params.sourceAsset.stored_size_bytes ?? null,
      compression_status: params.sourceAsset.compression_status ?? "not_applicable",
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as ContentReviewAsset;
}

export async function deleteContentReviewDraft(draftId: string) {
  await removeDraftStorage(draftId);

  const { data, error } = await supabase.rpc("delete_content_review_draft", {
    target_draft_id: draftId,
  });
  if (error) {
    const rpcMissing =
      error.code === "PGRST202" ||
      error.message?.toLowerCase().includes("could not find the function") ||
      error.message?.toLowerCase().includes("schema cache");
    if (!rpcMissing) {
      throw new Error(error.message || "Failed to delete draft.");
    }
    return deleteContentReviewDraftDirect(draftId);
  }
  const result = data as { ok: boolean; error?: string };
  if (!result.ok) {
    throw new Error(
      result.error === "forbidden"
        ? "You do not have access to delete this draft."
        : "Draft could not be deleted.",
    );
  }
  return result;
}

async function removeStoragePaths(paths: string[]) {
  const uniquePaths = Array.from(new Set(paths));
  if (uniquePaths.length === 0) return;
  const { error } = await supabase.storage.from(BUCKET).remove(uniquePaths);
  if (error) {
    throw new Error(error.message || "Failed to delete stored media.");
  }
}

async function removeDraftStorage(draftId: string) {
  const { data: assets, error: assetsError } = await supabase
    .from("content_review_assets")
    .select("storage_path")
    .eq("draft_id", draftId);
  if (assetsError) {
    throw new Error(assetsError.message || "Failed to load draft media for deletion.");
  }

  await removeStoragePaths(
    (assets ?? [])
      .map((asset) => asset.storage_path as string | null)
      .filter((path): path is string => Boolean(path)),
  );
}

async function deleteContentReviewDraftDirect(draftId: string) {
  const { error: deleteError } = await supabase
    .from("content_review_drafts")
    .delete()
    .eq("id", draftId);
  if (deleteError) {
    throw new Error(deleteError.message || "Failed to delete draft.");
  }

  return { ok: true };
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

async function getContentReviewNotificationRecipients(draft: ContentReviewDraft) {
  const recipientIds = new Set<string>();

  if (draft.created_by) recipientIds.add(draft.created_by);
  if (draft.assigned_to) recipientIds.add(draft.assigned_to);

  const { data, error } = await supabase
    .from("profiles")
    .select("id, office:company_offices!profiles_office_id_fkey(slug)")
    .eq("organization_id", draft.organization_id)
    .eq("primary_role", "admin");
  if (error) throw error;

  for (const profile of data ?? []) {
    const office = Array.isArray(profile.office) ? profile.office[0] : profile.office;
    if (office?.slug === OFFICE_SLUGS.itsNoMatata) {
      recipientIds.add(profile.id as string);
    }
  }

  return Array.from(recipientIds);
}

export async function notifyContentReviewTeam(params: {
  draft: ContentReviewDraft;
  title: string;
  message: string;
  priority?: "low" | "medium" | "high";
  dedupeKey?: string;
}) {
  try {
    const recipients = await getContentReviewNotificationRecipients(params.draft);
    if (recipients.length === 0) return;
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
          actionUrl: `/admin/content-studio/editor/${params.draft.id}`,
          metadata: { draftId: params.draft.id },
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
  decision: "comment" | "approved" | "changes_requested" | "revoke_approval";
}) {
  const { data, error } = await supabase.rpc("submit_content_review_feedback", {
    target_token: params.token,
    client_name: params.name,
    client_email: params.email,
    client_company: params.company ?? "",
    feedback_body: params.comment,
    decision: params.decision,
  });
  if (error) {
    const details = [error.message, error.details, error.hint]
      .filter(Boolean)
      .join(" | ");
    throw new Error(details || "submit_content_review_feedback failed");
  }
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
  await purgeOldContentReviewSchedules();
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
    feedback?: {
      has_approved: boolean;
      has_commented: boolean;
      has_requested_changes: boolean;
    };
  };
}

export type ContentClientFeedbackLimits = {
  has_approved: boolean;
  has_commented: boolean;
  has_requested_changes: boolean;
};

export async function submitContentClientReviewFeedback(params: {
  clientToken: string;
  sessionToken: string;
  email: string;
  draftId: string;
  comment: string;
  decision: "comment" | "approved" | "changes_requested" | "revoke_approval";
}) {
  const { data, error } = await supabase.rpc("submit_content_client_review_feedback", {
    client_token: params.clientToken,
    session_token: params.sessionToken,
    login_email: params.email,
    target_draft_id: params.draftId,
    feedback_body: params.comment,
    decision: params.decision,
  });
  if (error) {
    const details = [error.message, error.details, error.hint]
      .filter(Boolean)
      .join(" | ");
    throw new Error(details || "submit_content_client_review_feedback failed");
  }
  return data as {
    ok: boolean;
    error?:
      | string
      | "already_approved"
      | "already_commented"
      | "already_requested_changes"
      | "comment_required"
      | "read_only"
      | "unauthorized";
    status?: ContentReviewStatus;
    feedback?: ContentClientFeedbackLimits;
  };
}

function isImageGenerationMisroute(message: string) {
  return /could not return a generated image|no visible image attachment was produced/i.test(
    message,
  );
}

function isUndeployedEdgeFunctionError(message: string) {
  return /failed to send a request to the edge function|functions\.fetch|function not found|404.*function/i.test(
    message,
  );
}

function contentStudioEdgeAiEnabled() {
  return import.meta.env.VITE_CONTENT_STUDIO_EDGE_AI === "true";
}

function formatContentStudioN8nFailure(
  primary: Error,
  context: "caption" | "image_analysis",
) {
  const msg = primary.message.trim();
  if (isImageGenerationMisroute(msg)) {
    return context === "caption"
      ? "Caption assist was routed to image generation in n8n. Re-import n8n/itsnomatata-codex-internal-ai.production.workflow.json and publish it."
      : "Image analysis was routed to image generation in n8n. Re-import the updated Codex workflow and publish it.";
  }
  if (/missing vite_n8n_ai_webhook_url/i.test(msg)) {
    return "AI webhook is not configured. Set VITE_N8N_AI_WEBHOOK_URL in .env and restart the dev server.";
  }
  if (/webhook is not active|not registered/i.test(msg)) {
    return "n8n webhook is not active. Open your Codex workflow in n8n and turn it on (production mode, not test-only).";
  }
  if (/could not be reached|failed to fetch/i.test(msg)) {
    return `Could not reach n8n (${msg}). Check VITE_N8N_AI_WEBHOOK_URL and that the workflow is published.`;
  }
  if (/error in workflow/i.test(msg)) {
    return context === "caption"
      ? "n8n workflow failed (Error in workflow). In n8n → Executions, open the latest failed run and check which node errored (often 06 Codex Main Agent or Image Analysis Tool). Ensure: (1) workflow is published, (2) re-import n8n/itsnomatata-codex-internal-ai.production.workflow.json for the content_studio router patch, (3) OpenAI credential works on the main model, (4) n8n Variables include OPENAI_API_KEY or Image Analysis Tool uses the OpenAI credential, (5) optional: supabase secrets set OPENAI_API_KEY for codex-process-input."
      : "n8n workflow failed during image analysis. Check Executions for Image Analysis Tool or 06 Codex Main Agent. Set OPENAI_API_KEY in n8n Variables (or fix the OpenAI credential), ensure the post image URL is reachable (signed URL from storage), and re-import the updated Codex workflow JSON.";
  }
  const label = context === "caption" ? "Caption assist" : "Image analysis";
  return `${label} failed via n8n: ${msg}`;
}

/** Signed URL so n8n / vision can read private storage objects. */
export async function resolveContentReviewImageUrlForAi(input: {
  fileUrl: string;
  storagePath?: string | null;
}) {
  const path = input.storagePath?.trim();
  if (path) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 3600);
    if (!error && data?.signedUrl) return data.signedUrl;
  }
  return input.fileUrl;
}

function parseCaptionGeneratePayload(
  raw: string,
): ContentStudioCaptionGenerateOutput {
  let generatedCaption = raw.trim();
  let hashtags: string[] = [];
  let shortAlternative = "";

  if (generatedCaption.startsWith("{")) {
    try {
      const parsed = JSON.parse(generatedCaption) as Record<string, unknown>;
      generatedCaption = String(parsed.generatedCaption ?? generatedCaption);
      hashtags = Array.isArray(parsed.hashtags)
        ? parsed.hashtags.map((item) => String(item))
        : [];
      shortAlternative = String(parsed.shortAlternative ?? "");
    } catch {
      // keep text fallback
    }
  }

  if (isImageGenerationMisroute(generatedCaption)) {
    throw new Error(
      "Caption assist hit image generation in n8n instead of text. Re-import and publish n8n/itsnomatata-codex-internal-ai.production.workflow.json (router patch for content_studio_caption). You do not need OpenAI on Supabase if your n8n workflow already has OpenAI.",
    );
  }

  return { generatedCaption, hashtags, shortAlternative };
}

export async function generateContentStudioCaption(
  input: ContentStudioCaptionGenerateInput,
): Promise<ContentStudioCaptionGenerateOutput> {
  try {
    const { requestContentStudioCaption } = await import(
      "../../../lib/api/contentStudioAi"
    );
    return await requestContentStudioCaption(input);
  } catch {
    // fall through to legacy n8n path
  }

  const captionTask = [
    "Content Studio caption task — text only, not image generation.",
    `Client: ${input.clientName}`,
    `Schedule post: ${input.postTitle}`,
    input.mediaDescription ? `Media: ${input.mediaDescription}` : null,
    input.existingCaption ? `Current copy: ${input.existingCaption}` : null,
    input.instruction?.trim() || "Write fresh caption copy",
    input.platform ? `Channel (metadata): ${input.platform}` : null,
    input.tone ? `Tone (metadata): ${input.tone}` : null,
    "",
    "Return strict JSON only: { \"generatedCaption\": string, \"hashtags\": string[], \"shortAlternative\": string }",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await askAssistant({
      message: captionTask,
      context: buildAssistantContext({
        userId: "content-studio-system",
        organizationId: "content-studio",
        currentModule: "content-studio",
        currentRoute: "/admin/content-studio",
        role: "social_media",
        timezone: "Africa/Harare",
      }),
      metadata: {
        source: "content_studio_caption",
        forceTextOnly: true,
        platform: input.platform,
        tone: input.tone,
      },
    });

    return parseCaptionGeneratePayload(response.message || "");
  } catch (n8nError) {
    const primary =
      n8nError instanceof Error ? n8nError : new Error("Caption assist failed.");

    if (contentStudioEdgeAiEnabled()) {
      try {
        const { data, error } = await supabase.functions.invoke(
          "content-studio-generate-caption",
          { body: input },
        );
        if (!error && data && !data.error) {
          return parseCaptionGeneratePayload(
            JSON.stringify({
              generatedCaption: data.generatedCaption ?? "",
              hashtags: data.hashtags ?? [],
              shortAlternative: data.shortAlternative ?? "",
            }),
          );
        }
        if (error && !isUndeployedEdgeFunctionError(error.message)) {
          throw new Error(error.message);
        }
      } catch (edgeError) {
        if (
          edgeError instanceof Error &&
          !isUndeployedEdgeFunctionError(edgeError.message)
        ) {
          throw new Error(
            `${formatContentStudioN8nFailure(primary, "caption")} (Edge: ${edgeError.message})`,
          );
        }
      }
    }

    throw new Error(formatContentStudioN8nFailure(primary, "caption"));
  }
}

function parseImageAnalysisPayload(raw: string): ContentStudioImageAnalysis {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error(
      "n8n returned an empty response for image analysis. Check the workflow execution log and that OpenAI vision is configured in n8n Variables.",
    );
  }
  if (isImageGenerationMisroute(trimmed)) {
    throw new Error(
      "Image analysis was routed to image generation in n8n. Re-import n8n/itsnomatata-codex-internal-ai.production.workflow.json and publish it.",
    );
  }

  const fallback: ContentStudioImageAnalysis = {
    mood: "Professional",
    sceneDescription: trimmed || "No scene description returned.",
    generatedCaption: trimmed,
    hashtags: [],
    shortAlternative: "",
  };

  if (!trimmed.startsWith("{")) return fallback;

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    return {
      mood: String(parsed.mood ?? parsed.Mood ?? "Professional"),
      sceneDescription: String(
        parsed.sceneDescription ?? parsed.scene ?? parsed.scene_description ?? "",
      ),
      generatedCaption: String(
        parsed.generatedCaption ?? parsed.caption ?? parsed.captionSuggestion ?? "",
      ),
      hashtags: Array.isArray(parsed.hashtags)
        ? parsed.hashtags.map((item) => String(item))
        : [],
      shortAlternative: String(parsed.shortAlternative ?? parsed.shortCaption ?? ""),
      instagramCaption: parsed.instagramCaption
        ? String(parsed.instagramCaption)
        : undefined,
      facebookCaption: parsed.facebookCaption
        ? String(parsed.facebookCaption)
        : undefined,
    };
  } catch {
    return fallback;
  }
}

async function analyzeContentStudioImageViaN8n(
  input: Parameters<typeof analyzeContentStudioImage>[0],
): Promise<ContentStudioImageAnalysis> {
  const prompt = [
    `Client: ${input.clientName}`,
    `Post: ${input.postTitle}`,
    input.existingCaption ? `Existing caption: ${input.existingCaption}` : null,
    "",
    "Analyze this image for social content. Describe what you see in the photo.",
    "Return strict JSON only with keys:",
    "mood, sceneDescription, generatedCaption, hashtags (array), shortAlternative, instagramCaption, facebookCaption",
  ]
    .filter(Boolean)
    .join("\n");

  const response = await askAssistant({
    message: prompt,
    context: buildAssistantContext({
      userId: input.userId ?? "content-studio-system",
      organizationId: input.organizationId ?? "content-studio",
      currentModule: "content-studio",
      currentRoute: "/admin/content-studio/clients",
      role: "social_media",
      timezone: "Africa/Harare",
    }),
    attachments: [
      {
        name: input.fileName ?? "post-image",
        type: "image",
        url: input.imageUrl,
        mimeType: "image/jpeg",
      },
    ],
    metadata: {
      source: "content_studio_image_analysis",
      forceImageVision: true,
    },
  });

  return parseImageAnalysisPayload(response.message || "");
}

async function analyzeContentStudioImageViaEdge(
  input: Parameters<typeof analyzeContentStudioImage>[0],
): Promise<ContentStudioImageAnalysis> {
  const { data, error } = await supabase.functions.invoke("content-studio-analyze-image", {
    body: input,
  });
  if (error) {
    throw new Error(error.message || "content-studio-analyze-image failed");
  }
  if (data?.error) {
    throw new Error(String(data.error));
  }
  if (!data) {
    throw new Error("content-studio-analyze-image returned no data");
  }
  return parseImageAnalysisPayload(
    JSON.stringify({
      mood: data.mood,
      sceneDescription: data.sceneDescription,
      generatedCaption: data.generatedCaption,
      hashtags: data.hashtags,
      shortAlternative: data.shortAlternative,
      instagramCaption: data.instagramCaption,
      facebookCaption: data.facebookCaption,
    }),
  );
}

/**
 * Image analysis via n8n (Codex webhook + OpenAI in your workflow).
 * Supabase edge is opt-in only (VITE_CONTENT_STUDIO_EDGE_AI=true).
 */
export async function analyzeContentStudioImage(input: {
  clientName: string;
  postTitle: string;
  existingCaption?: string;
  imageUrl: string;
  storagePath?: string | null;
  fileName?: string;
  userId?: string;
  organizationId?: string;
}): Promise<ContentStudioImageAnalysis> {
  const imageUrl = await resolveContentReviewImageUrlForAi({
    fileUrl: input.imageUrl,
    storagePath: input.storagePath,
  });

  try {
    return await analyzeContentStudioImageViaN8n({ ...input, imageUrl });
  } catch (n8nError) {
    const primary =
      n8nError instanceof Error ? n8nError : new Error("Image analysis failed.");

    if (!contentStudioEdgeAiEnabled()) {
      throw new Error(formatContentStudioN8nFailure(primary, "image_analysis"));
    }

    try {
      return await analyzeContentStudioImageViaEdge({ ...input, imageUrl });
    } catch (edgeError) {
      const edgeMsg =
        edgeError instanceof Error ? edgeError.message : String(edgeError);
      if (isUndeployedEdgeFunctionError(edgeMsg)) {
        throw new Error(formatContentStudioN8nFailure(primary, "image_analysis"));
      }
      throw new Error(
        `${formatContentStudioN8nFailure(primary, "image_analysis")} (Edge: ${edgeMsg})`,
      );
    }
  }
}
