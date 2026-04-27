import { supabase } from "../client";

export interface SocialMediaAccount {
  id: string;
  organization_id: string;
  user_id: string;
  platform: string;
  account_id: string;
  username: string;
  display_name: string | null;
  profile_image_url: string | null;
  is_active: boolean;
  is_verified: boolean;
  follower_count: number;
  following_count: number;
  posts_count: number;
  engagement_rate: number;
  last_sync_at: string | null;
  sync_status: string;
  platform_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SocialPost {
  id: string;
  organization_id: string;
  client_id: string | null;
  campaign_id: string | null;
  title: string;
  body: string | null;
  platform: string;
  status: string;
  priority: string;
  scheduled_for: string | null;
  estimated_hours: number;
  spent_hours: number;
  ai_angle: string | null;
  owner_id: string | null;
  created_by: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SocialPostAsset {
  id: string;
  social_post_id: string;
  content_asset_id: string;
  sort_order: number;
  notes: string | null;
  created_at: string;
}

export async function getSocialMediaAccounts(
  organizationId: string
): Promise<SocialMediaAccount[]> {
  const { data, error } = await supabase
    .from("social_media_accounts")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getSocialMediaAccount(
  accountId: string
): Promise<SocialMediaAccount | null> {
  const { data, error } = await supabase
    .from("social_media_accounts")
    .select("*")
    .eq("id", accountId)
    .single();

  if (error) throw error;
  return data;
}

export async function getSocialPosts(
  organizationId: string,
  filters?: {
    status?: string;
    platform?: string;
    campaignId?: string;
    clientId?: string;
  }
): Promise<SocialPost[]> {
  let query = supabase
    .from("social_posts")
    .select("*")
    .eq("organization_id", organizationId);

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }
  if (filters?.platform) {
    query = query.eq("platform", filters.platform);
  }
  if (filters?.campaignId) {
    query = query.eq("campaign_id", filters.campaignId);
  }
  if (filters?.clientId) {
    query = query.eq("client_id", filters.clientId);
  }

  const { data, error } = await query.order("scheduled_for", {
    ascending: true,
    nullsFirst: false,
  });

  if (error) throw error;
  return data || [];
}

export async function getSocialPost(postId: string): Promise<SocialPost | null> {
  const { data, error } = await supabase
    .from("social_posts")
    .select("*")
    .eq("id", postId)
    .single();

  if (error) throw error;
  return data;
}

export async function getSocialPostAssets(
  postId: string
): Promise<SocialPostAsset[]> {
  const { data, error } = await supabase
    .from("social_post_assets")
    .select("*")
    .eq("social_post_id", postId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getSocialMediaStats(organizationId: string) {
  const [accountsResult, postsResult] = await Promise.all([
    supabase
      .from("social_media_accounts")
      .select("follower_count, engagement_rate, posts_count")
      .eq("organization_id", organizationId)
      .eq("is_active", true),
    supabase
      .from("social_posts")
      .select("status, platform")
      .eq("organization_id", organizationId),
  ]);

  if (accountsResult.error) throw accountsResult.error;
  if (postsResult.error) throw postsResult.error;

  const accounts = accountsResult.data || [];
  const posts = postsResult.data || [];

  const totalFollowers = accounts.reduce((sum, acc) => sum + (acc.follower_count || 0), 0);
  const avgEngagement = accounts.length > 0
    ? accounts.reduce((sum, acc) => sum + (acc.engagement_rate || 0), 0) / accounts.length
    : 0;
  const totalPosts = posts.length;

  const postsByStatus = posts.reduce((acc, post) => {
    acc[post.status] = (acc[post.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const postsByPlatform = posts.reduce((acc, post) => {
    acc[post.platform] = (acc[post.platform] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    totalFollowers,
    avgEngagement,
    totalPosts,
    postsByStatus,
    postsByPlatform,
    activeAccounts: accounts.length,
  };
}
