import { supabase } from "../../../lib/supabase/client";

const PROFILE_BUCKET = "profile-pictures";

function sanitizeFileName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_");
}

function extensionFromFile(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName) return fromName;
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/gif") return "gif";
  return "jpg";
}

export async function uploadProfilePicture(params: {
  userId: string;
  file: File;
}) {
  const { userId, file } = params;
  const extension = extensionFromFile(file);
  const safeName = sanitizeFileName(file.name || `avatar.${extension}`);
  const filePath = `${userId}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage
    .from(PROFILE_BUCKET)
    .upload(filePath, file, {
      cacheControl: "3600",
      contentType: file.type || undefined,
      upsert: true,
    });

  if (error) throw error;

  const { data } = supabase.storage
    .from(PROFILE_BUCKET)
    .getPublicUrl(filePath);

  return {
    filePath,
    publicUrl: data.publicUrl,
  };
}

export async function updateMyProfile(params: {
  userId: string;
  fullName: string;
  username: string;
  avatarUrl?: string | null;
}) {
  const nextFullName = params.fullName.trim() || null;
  const nextUsername = params.username.trim() || nextFullName;
  const updates: Record<string, string | null> = {
    full_name: nextFullName,
    username: nextUsername,
    updated_at: new Date().toISOString(),
  };

  if (params.avatarUrl !== undefined) {
    updates.avatar_url = params.avatarUrl;
  }

  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", params.userId);

  if (error) throw error;

  const { error: authError } = await supabase.auth.updateUser({
    data: {
      full_name: nextFullName,
      name: nextFullName,
      username: nextUsername,
      avatar_url: params.avatarUrl ?? undefined,
    },
  });

  if (authError) throw authError;
}
