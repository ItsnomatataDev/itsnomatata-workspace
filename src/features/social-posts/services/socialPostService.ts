import { supabase } from "../../../lib/supabase/client";

export type SocialPlatform =
	| "LinkedIn"
	| "Instagram"
	| "Facebook"
	| "X"
	| "TikTok";

export type SocialPostStatus =
	| "draft"
	| "review"
	| "approval"
	| "scheduled"
	| "published";

export type SocialPostPriority = "low" | "medium" | "high";

export interface SocialPostRecord {
	id: string;
	organization_id: string;
	client_id: string | null;
	campaign_id: string | null;
	title: string;
	body: string | null;
	platform: SocialPlatform;
	status: SocialPostStatus;
	priority: SocialPostPriority;
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

export interface GetSocialPostsInput {
	organizationId: string;
	clientId?: string;
	campaignId?: string;
	status?: SocialPostStatus;
}

export interface CreateSocialPostInput {
	organizationId: string;
	title: string;
	platform: SocialPlatform;
	clientId?: string | null;
	campaignId?: string | null;
	status?: SocialPostStatus;
	priority?: SocialPostPriority;
	scheduledFor?: string | null;
	estimatedHours?: number;
	spentHours?: number;
	aiAngle?: string | null;
	ownerId?: string | null;
	createdBy?: string | null;
	body?: string | null;
	metadata?: Record<string, unknown>;
}

export interface UpdateSocialPostInput {
	title?: string;
	body?: string | null;
	platform?: SocialPlatform;
	client_id?: string | null;
	campaign_id?: string | null;
	status?: SocialPostStatus;
	priority?: SocialPostPriority;
	scheduled_for?: string | null;
	estimated_hours?: number;
	spent_hours?: number;
	ai_angle?: string | null;
	owner_id?: string | null;
	metadata?: Record<string, unknown>;
}

export const SOCIAL_STATUS_FLOW: SocialPostStatus[] = [
	"draft",
	"review",
	"approval",
	"scheduled",
	"published",
];

function toReadableError(error: unknown) {
	if (error instanceof Error) {
		return error.message;
	}

	// Handle Supabase error objects
	if (error && typeof error === "object") {
		const err = error as Record<string, unknown>;

		// Check for database constraint violation
		if (err.message && typeof err.message === "string") {
			return err.message;
		}

		// Check for status code patterns
		if (err.status === 403) {
			return "Permission denied. Check your organization access.";
		}
		if (err.status === 400) {
			return `Invalid data: ${err.message || "Check your input values."}`;
		}
		if (err.status === 409) {
			return "Duplicate entry or conflict with existing data.";
		}
	}

	return "Social post operation failed. Please try again.";
}

export async function getSocialPosts({
	organizationId,
	clientId,
	campaignId,
	status,
}: GetSocialPostsInput): Promise<SocialPostRecord[]> {
	let query = supabase
		.from("social_posts")
		.select("*")
		.eq("organization_id", organizationId)
		.order("scheduled_for", { ascending: true, nullsFirst: false })
		.order("created_at", { ascending: false });

	if (clientId) {
		query = query.eq("client_id", clientId);
	}

	if (campaignId) {
		query = query.eq("campaign_id", campaignId);
	}

	if (status) {
		query = query.eq("status", status);
	}

	const { data, error } = await query;

	if (error) {
		throw new Error(toReadableError(error));
	}

	return (data ?? []) as SocialPostRecord[];
}

export async function createSocialPost(
	payload: CreateSocialPostInput,
): Promise<SocialPostRecord> {
	const { data, error } = await supabase
		.from("social_posts")
		.insert({
			organization_id: payload.organizationId,
			title: payload.title,
			platform: payload.platform,
			client_id: payload.clientId ?? null,
			campaign_id: payload.campaignId ?? null,
			status: payload.status ?? "draft",
			priority: payload.priority ?? "medium",
			scheduled_for: payload.scheduledFor ?? null,
			estimated_hours: payload.estimatedHours ?? 1,
			spent_hours: payload.spentHours ?? 0,
			ai_angle: payload.aiAngle ?? null,
			owner_id: payload.ownerId ?? null,
			created_by: payload.createdBy ?? null,
			body: payload.body ?? null,
			metadata: payload.metadata ?? {},
		})
		.select("*")
		.single();

	if (error) {
		console.error("Social post creation error:", {
			message: error.message,
			code: error.code,
			details: error.details,
			hint: error.hint,
		});
		throw new Error(toReadableError(error));
	}

	return data as SocialPostRecord;
}

export async function updateSocialPost(
	postId: string,
	payload: UpdateSocialPostInput,
): Promise<SocialPostRecord> {
	const { data, error } = await supabase
		.from("social_posts")
		.update(payload)
		.eq("id", postId)
		.select("*")
		.single();

	if (error) {
		throw new Error(toReadableError(error));
	}

	return data as SocialPostRecord;
}

export async function updateSocialPostStatus(
	postId: string,
	status: SocialPostStatus,
): Promise<SocialPostRecord> {
	return updateSocialPost(postId, { status });
}

export async function deleteSocialPost(postId: string): Promise<void> {
	const { error } = await supabase.from("social_posts").delete().eq(
		"id",
		postId,
	);

	if (error) {
		throw new Error(toReadableError(error));
	}
}

export function getNextSocialStatus(
	status: SocialPostStatus,
): SocialPostStatus {
	const index = SOCIAL_STATUS_FLOW.indexOf(status);

	if (index < 0 || index === SOCIAL_STATUS_FLOW.length - 1) {
		return status;
	}

	return SOCIAL_STATUS_FLOW[index + 1];
}
