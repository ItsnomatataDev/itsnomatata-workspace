import { supabase } from "../../../lib/supabase/client";
import type { ContentAsset } from "../../../lib/supabase/queries/contentAssets";

interface SocialPostAssetLink {
	id: string;
	social_post_id: string;
	content_asset_id: string;
	sort_order: number;
	notes: string | null;
	created_at: string;
}

export async function getSocialPostAssets(
	socialPostId: string,
): Promise<ContentAsset[]> {
	const { data, error } = await supabase
		.from("social_post_assets")
		.select("content_assets(*)")
		.eq("social_post_id", socialPostId)
		.order("sort_order", { ascending: true });

	if (error) {
		throw new Error(error.message);
	}

	return (data ?? [])
		.map((item) => item.content_assets)
		.filter(Boolean) as unknown as ContentAsset[];
}

export async function attachAssetToSocialPost({
	socialPostId,
	contentAssetId,
	sortOrder,
	notes,
}: {
	socialPostId: string;
	contentAssetId: string;
	sortOrder?: number;
	notes?: string | null;
}): Promise<SocialPostAssetLink> {
	const { data, error } = await supabase
		.from("social_post_assets")
		.insert({
			social_post_id: socialPostId,
			content_asset_id: contentAssetId,
			sort_order: sortOrder ?? 0,
			notes: notes ?? null,
		})
		.select("*")
		.single();

	if (error) {
		throw new Error(error.message);
	}

	return data as SocialPostAssetLink;
}

export async function detachAssetFromSocialPost(
	socialPostId: string,
	contentAssetId: string,
): Promise<void> {
	const { error } = await supabase
		.from("social_post_assets")
		.delete()
		.eq("social_post_id", socialPostId)
		.eq("content_asset_id", contentAssetId);

	if (error) {
		throw new Error(error.message);
	}
}
