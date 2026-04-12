import { useMemo } from "react";
import { useCampaigns } from "./useCampaigns";
import { useClients } from "./useClients";
import { useTimeEntries } from "./useTimeEntries";

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

export interface SocialQueueItem {
    id: string;
    title: string;
    clientName: string;
    campaignName: string;
    platform: SocialPlatform;
    status: SocialPostStatus;
    scheduledFor: string;
    priority: "low" | "medium" | "high";
    ownerLabel: string;
    estimatedHours: number;
    spentHours: number;
    aiAngle: string;
}

export interface SocialClientWorkload {
    clientId: string;
    clientName: string;
    activeCampaigns: number;
    queuedPosts: number;
    plannedHours: number;
    trackedHours: number;
    status: "healthy" | "watch" | "overloaded";
}

export interface TeamCapacityItem {
    label: string;
    plannedHours: number;
    allocatedHours: number;
    utilization: number;
}

export interface SocialAIPrompt {
    id: string;
    title: string;
    description: string;
    prompt: string;
}

const PLATFORM_ROTATION: SocialPlatform[] = [
    "LinkedIn",
    "Instagram",
    "Facebook",
    "X",
    "TikTok",
];

const OWNER_ROTATION = [
    "Content strategist",
    "Copy lead",
    "Designer",
    "Community manager",
    "Paid media lead",
];

function formatDateInput(date: Date) {
    return date.toISOString().slice(0, 10);
}

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

export const useSocialPosts = ({
    organizationId,
    userId,
    fullName,
}: {
    organizationId?: string | null;
    userId?: string | null;
    fullName?: string | null;
}) => {
    const today = useMemo(() => new Date(), []);
    const startDate = useMemo(() => {
        const date = new Date(today);
        date.setDate(date.getDate() - 30);
        return formatDateInput(date);
    }, [today]);
    const endDate = useMemo(() => formatDateInput(today), [today]);

    const clientsState = useClients({
        organizationId,
        userId: userId ?? undefined,
    });
    const campaignsState = useCampaigns({ organizationId });
    const timeState = useTimeEntries({
        organizationId,
        userId,
        startDate,
        endDate,
    });

    const clientsById = useMemo(
        () =>
            new Map(clientsState.clients.map((client) => [client.id, client])),
        [clientsState.clients],
    );

    const queue = useMemo<SocialQueueItem[]>(() => {
        const sourceCampaigns = campaignsState.campaigns.slice(0, 8);

        if (sourceCampaigns.length > 0) {
            return sourceCampaigns.map((campaign, index) => {
                const client = clientsById.get(campaign.client_id);
                const scheduledDate = new Date(today);
                scheduledDate.setDate(today.getDate() + index);

                const mappedStatus: SocialPostStatus =
                    campaign.status === "completed"
                        ? "published"
                        : campaign.status === "review"
                        ? "approval"
                        : campaign.status === "planned"
                        ? "scheduled"
                        : campaign.status === "draft"
                        ? "draft"
                        : "review";

                const estimatedHours = Number((2.5 + index * 0.8).toFixed(1));
                const spentHours = Number(
                    Math.min(
                        estimatedHours,
                        1.2 + index * 0.65 +
                            timeState.totals.totalSeconds / 3600 / 40,
                    ).toFixed(1),
                );

                return {
                    id: campaign.id,
                    title: `${campaign.name} hero post`,
                    clientName: client?.name ?? "Client",
                    campaignName: campaign.name,
                    platform:
                        PLATFORM_ROTATION[index % PLATFORM_ROTATION.length],
                    status: mappedStatus,
                    scheduledFor: scheduledDate.toISOString(),
                    priority:
                        campaign.status === "review" ||
                            campaign.status === "in_progress"
                            ? "high"
                            : campaign.status === "planned"
                            ? "medium"
                            : "low",
                    ownerLabel: index === 0 && fullName
                        ? fullName
                        : OWNER_ROTATION[index % OWNER_ROTATION.length],
                    estimatedHours,
                    spentHours,
                    aiAngle: campaign.objective ||
                        "Repurpose campaign positioning into platform-specific messaging.",
                };
            });
        }

        return clientsState.clients.slice(0, 6).map((client, index) => {
            const scheduledDate = new Date(today);
            scheduledDate.setDate(today.getDate() + index + 1);

            return {
                id: `${client.id}-social-seed`,
                title: `${client.name} weekly content pack`,
                clientName: client.name,
                campaignName: "Always-on social",
                platform: PLATFORM_ROTATION[index % PLATFORM_ROTATION.length],
                status: index < 2
                    ? "review"
                    : index < 4
                    ? "scheduled"
                    : "draft",
                scheduledFor: scheduledDate.toISOString(),
                priority: index < 2 ? "high" : "medium",
                ownerLabel: OWNER_ROTATION[index % OWNER_ROTATION.length],
                estimatedHours: Number((2 + index * 0.5).toFixed(1)),
                spentHours: Number((1.2 + index * 0.35).toFixed(1)),
                aiAngle: client.brand_voice ||
                    "Build a clear, client-aligned brand voice thread.",
            };
        });
    }, [
        campaignsState.campaigns,
        clientsById,
        clientsState.clients,
        fullName,
        timeState.totals.totalSeconds,
        today,
    ]);

    const workload = useMemo<SocialClientWorkload[]>(() => {
        return clientsState.clients.slice(0, 6).map((client, index) => {
            const activeCampaigns = campaignsState.campaigns.filter(
                (campaign) =>
                    campaign.client_id === client.id &&
                    campaign.status !== "cancelled",
            ).length;
            const queuedPosts = queue.filter((item) =>
                item.clientName === client.name
            ).length;
            const trackedHours = Number(
                ((timeState.totals.totalSeconds / 3600) * (0.18 + index * 0.06))
                    .toFixed(1),
            );
            const plannedHours = Number(
                (Math.max(6, queuedPosts * 3 + activeCampaigns * 2.5)).toFixed(
                    1,
                ),
            );
            const utilization = plannedHours === 0
                ? 0
                : trackedHours / plannedHours;

            return {
                clientId: client.id,
                clientName: client.name,
                activeCampaigns,
                queuedPosts,
                plannedHours,
                trackedHours,
                status: utilization > 0.95
                    ? "overloaded"
                    : utilization > 0.72
                    ? "watch"
                    : "healthy",
            };
        });
    }, [
        campaignsState.campaigns,
        clientsState.clients,
        queue,
        timeState.totals.totalSeconds,
    ]);

    const teamCapacity = useMemo<TeamCapacityItem[]>(() => {
        const totalHours = Math.max(timeState.totals.totalSeconds / 3600, 12);

        return [
            {
                label: "Content strategy",
                plannedHours: 18,
                allocatedHours: totalHours * 0.28,
                utilization: 0,
            },
            {
                label: "Copywriting",
                plannedHours: 24,
                allocatedHours: totalHours * 0.32,
                utilization: 0,
            },
            {
                label: "Design & editing",
                plannedHours: 20,
                allocatedHours: totalHours * 0.24,
                utilization: 0,
            },
            {
                label: "Community management",
                plannedHours: 14,
                allocatedHours: totalHours * 0.16,
                utilization: 0,
            },
        ].map((item) => ({
            ...item,
            allocatedHours: Number(item.allocatedHours.toFixed(1)),
            utilization: clamp(item.allocatedHours / item.plannedHours, 0, 1.4),
        }));
    }, [timeState.totals.totalSeconds]);

    const metrics = useMemo(() => {
        const trackedHours = Number(
            (timeState.totals.totalSeconds / 3600).toFixed(1),
        );
        const scheduledThisWeek = queue.filter((item) => {
            const itemDate = new Date(item.scheduledFor);
            const diff = itemDate.getTime() - today.getTime();
            return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
        }).length;

        return {
            scheduledThisWeek,
            waitingApproval: queue.filter((item) =>
                item.status === "approval" || item.status === "review"
            ).length,
            activeClients: clientsState.stats.activeClients,
            trackedHours,
            billableHours: Number(
                (timeState.totals.billableSeconds / 3600).toFixed(1),
            ),
            totalQueue: queue.length,
            runningTimerLabel: timeState.activeEntry?.description ||
                queue[0]?.title || null,
        };
    }, [
        clientsState.stats.activeClients,
        queue,
        timeState.activeEntry?.description,
        timeState.totals.billableSeconds,
        timeState.totals.totalSeconds,
        today,
    ]);

    const aiPrompts = useMemo<SocialAIPrompt[]>(() => {
        const topClient = workload[0]?.clientName ||
            clientsState.clients[0]?.name || "our priority client";
        const topCampaign = queue[0]?.campaignName ||
            campaignsState.campaigns[0]?.name || "our current campaign";

        return [
            {
                id: "weekly-plan",
                title: "Weekly publishing plan",
                description:
                    "Generate a platform-by-platform weekly plan tied to current campaigns and time constraints.",
                prompt:
                    `Build a weekly social publishing plan for ${topClient}. Use ${topCampaign} as the main campaign, keep the workload realistic for a small team, and include platform mix, CTA, and time-saving repurposing ideas.`,
            },
            {
                id: "time-audit",
                title: "Time-saving audit",
                description:
                    "Ask the assistant where the team is spending too much effort and what to automate.",
                prompt:
                    `Review our social production workflow and identify where we are overspending time. Suggest automation, batching, approval improvements, and reusable templates for social media operations.`,
            },
            {
                id: "client-report",
                title: "Client update draft",
                description:
                    "Create a polished progress update for client communication and internal standups.",
                prompt:
                    `Draft a client-facing update for ${topClient} covering content delivered, campaign momentum, next scheduled posts, risks, and how the team is managing time efficiently this week.`,
            },
        ];
    }, [campaignsState.campaigns, clientsState.clients, queue, workload]);

    return {
        queue,
        workload,
        teamCapacity,
        aiPrompts,
        metrics,
        clients: clientsState.clients,
        campaigns: campaignsState.campaigns,
        myClients: clientsState.myClients,
        loading: clientsState.loading || campaignsState.loading ||
            timeState.loading,
        error: clientsState.error || campaignsState.error || timeState.error ||
            "",
        hasOrganization: Boolean(organizationId),
    };
};
