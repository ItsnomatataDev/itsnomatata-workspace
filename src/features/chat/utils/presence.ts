const ONLINE_WINDOW_MS = 2 * 60 * 1000;

export function isRecentlyOnline(lastSeenAt?: string | null) {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() <= ONLINE_WINDOW_MS;
}

export async function touchChatPresence(userId: string) {
  const { supabase } = await import("../../../lib/supabase/client");
  await supabase
    .from("profiles")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", userId);
}
