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
const ASSET_RETENTION_DAYS = 60;
const SCHEDULE_RETENTION_DAYS = 60;
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

export async function listContentReviewDrafts(params: {
  organizationId: string;
  officeId: string;
  status?: ContentReviewStatus | "all";
  clientId?: string;
}) {
  await cleanupExpiredContentReviewAssets();
  await purgeOldContentReviewSchedules();

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

export async function getContentReviewDetail(params: {
  organizationId: string;
  officeId: string;
  draftId: string;
}): Promise<ContentReviewDetail> {
  await cleanupExpiredContentReviewAssets();
  await purgeOldContentReviewSchedules();
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

export async function deleteContentClient(clientId: string) {
  const { data: assets, error: assetsError } = await supabase
    .from("content_review_assets")
    .select("storage_path, draft:content_review_drafts!inner(client_id)")
    .eq("draft.client_id", clientId);
  if (assetsError) {
    throw new Error(assetsError.message || "Failed to load client media for deletion.");
  }

  await removeStoragePaths(
    (assets ?? [])
      .map((asset) => asset.storage_path as string | null)
      .filter((path): path is string => Boolean(path)),
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
  if (asset.storage_path) {
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
    },
  });
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
