import { useMemo, useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  Clock3,
  Copy,
  Megaphone,
  Sparkles,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../../app/providers/AuthProvider";
import Sidebar from "../../../components/dashboard/components/Siderbar";
import type { AssistantContextInput } from "../../../lib/api/n8n";
import { useSocialPosts } from "../../../lib/hooks/useSocialPosts";
import AiChatPanel from "../../ai-assistant/components/AiChatPanel";
import CalendarView from "../components/CalendarView";
import SocialPostCard from "../components/SocialPostCard";
import SocialPostForm from "../components/SocialPostForm";

function MetricCard({
  label,
  value,
  note,
  icon: Icon,
}: {
  label: string;
  value: string;
  note: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">
            {label}
          </p>
          <p className="mt-3 text-3xl font-bold text-white">{value}</p>
          <p className="mt-2 text-sm text-white/50">{note}</p>
        </div>
        <div className="rounded-2xl bg-orange-500/15 p-3 text-orange-300">
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

function formatHours(hours: number) {
  return `${hours.toFixed(1)}h`;
}

export default function SocialPostsPage() {
  const auth = useAuth();
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [copied, setCopied] = useState(false);

  if (!auth?.user || !auth.profile) return null;

  const { user, profile } = auth;

  const social = useSocialPosts({
    organizationId: profile.organization_id,
    userId: user.id,
    fullName: profile.full_name,
  });

  const aiContext = useMemo<AssistantContextInput>(
    () => ({
      userId: user.id,
      fullName: profile.full_name ?? "Workspace User",
      email: user.email ?? null,
      role: profile.primary_role ?? "social_media",
      department:
        typeof profile.department === "string"
          ? profile.department
          : "Social media",
      organizationId: profile.organization_id ?? null,
      currentRoute: "/social-posts",
      currentModule: "social-posts",
      selectedEntityId: social.campaigns[0]?.id ?? null,
      selectedEntityType: social.campaigns[0] ? "campaign" : null,
      timezone: "Africa/Harare",
      channel: "dashboard",
    }),
    [
      profile.department,
      profile.full_name,
      profile.organization_id,
      profile.primary_role,
      social.campaigns,
      user.email,
      user.id,
    ],
  );

  async function handleCopyPrompt() {
    if (!generatedPrompt) return;

    try {
      await navigator.clipboard.writeText(generatedPrompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (error) {
      console.error("COPY PROMPT ERROR:", error);
    }
  }

  if (!social.hasOrganization) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="flex min-h-screen">
          <Sidebar role={profile.primary_role} />
          <main className="flex-1 p-6 lg:p-8">
            <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-red-200">
              Your account is not linked to an organization yet, so the social
              dashboard cannot load real client and campaign data.
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen">
        <Sidebar role={profile.primary_role} />

        <main className="min-w-0 flex-1 p-6 lg:p-8">
          <section className="rounded-4xl border border-white/10 bg-linear-to-br from-white/8 via-white/5 to-orange-500/10 p-6 lg:p-8">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-4xl">
                <p className="text-xs uppercase tracking-[0.32em] text-orange-300">
                  Social media operations
                </p>
                <h1 className="mt-3 text-3xl font-bold lg:text-5xl">
                  A real social dashboard for client delivery, team capacity,
                  and AI-assisted production.
                </h1>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-white/65 lg:text-base">
                  This workspace gives ITsNomatata one place to manage campaign
                  output, client workload, approval pressure, publishing
                  cadence, and time usage while using the built-in AI assistant
                  to plan content faster.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <Link
                  to="/campaigns"
                  className="rounded-2xl border border-white/10 bg-black/35 px-4 py-4 text-sm font-medium text-white transition hover:border-orange-500/30 hover:bg-black/45"
                >
                  Campaigns
                  <span className="mt-2 flex items-center gap-2 text-white/50">
                    Open live campaigns <ArrowRight size={14} />
                  </span>
                </Link>
                <Link
                  to="/time"
                  className="rounded-2xl border border-white/10 bg-black/35 px-4 py-4 text-sm font-medium text-white transition hover:border-orange-500/30 hover:bg-black/45"
                >
                  Time tracking
                  <span className="mt-2 flex items-center gap-2 text-white/50">
                    Review team hours <ArrowRight size={14} />
                  </span>
                </Link>
                <Link
                  to="/ai-workspace"
                  className="rounded-2xl border border-orange-500/20 bg-orange-500/10 px-4 py-4 text-sm font-medium text-orange-100 transition hover:bg-orange-500/15"
                >
                  AI workspace
                  <span className="mt-2 flex items-center gap-2 text-orange-200/80">
                    Open full assistant <ArrowRight size={14} />
                  </span>
                </Link>
              </div>
            </div>
          </section>

          {social.error ? (
            <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {social.error}
            </div>
          ) : null}

          <section className="mt-6 grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
            <MetricCard
              label="Scheduled this week"
              value={String(social.metrics.scheduledThisWeek)}
              note="Upcoming platform-ready content already in the queue."
              icon={CalendarDays}
            />
            <MetricCard
              label="Waiting on review"
              value={String(social.metrics.waitingApproval)}
              note="Items currently creating approval or revision pressure."
              icon={Megaphone}
            />
            <MetricCard
              label="Active clients"
              value={String(social.metrics.activeClients)}
              note="Clients currently being served by the social team."
              icon={Users}
            />
            <MetricCard
              label="Tracked social hours"
              value={formatHours(social.metrics.trackedHours)}
              note={
                social.metrics.runningTimerLabel
                  ? `Current timer context: ${social.metrics.runningTimerLabel}`
                  : "No active timer detected right now."
              }
              icon={Clock3}
            />
          </section>

          <section className="mt-6 grid gap-6 2xl:grid-cols-[minmax(0,1.25fr)_420px]">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 lg:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Publishing queue</h2>
                  <p className="mt-1 text-sm text-white/50">
                    Operational view of what is being prepared, reviewed, and
                    scheduled.
                  </p>
                </div>
                <div className="rounded-2xl bg-black/30 px-3 py-2 text-sm text-white/65">
                  {social.metrics.totalQueue} items
                </div>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                {social.loading ? (
                  <div className="rounded-3xl border border-white/10 bg-black/30 p-6 text-sm text-white/45">
                    Loading social operations...
                  </div>
                ) : social.queue.length > 0 ? (
                  social.queue.map((item) => (
                    <SocialPostCard key={item.id} item={item} />
                  ))
                ) : (
                  <div className="rounded-3xl border border-white/10 bg-black/30 p-6 text-sm text-white/45">
                    No queue items yet. Start by creating campaigns and
                    assigning clients.
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-orange-500/15 p-3 text-orange-300">
                    <BriefcaseBusiness size={18} />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">Client workload</h2>
                    <p className="text-sm text-white/50">
                      See where campaign volume and time usage are starting to
                      drift.
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {social.workload.map((item) => (
                    <div
                      key={item.clientId}
                      className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-white">
                            {item.clientName}
                          </h3>
                          <p className="mt-1 text-sm text-white/45">
                            {item.activeCampaigns} campaigns ·{" "}
                            {item.queuedPosts} queued posts
                          </p>
                        </div>
                        <span
                          className={[
                            "rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
                            item.status === "overloaded"
                              ? "bg-red-500/15 text-red-300"
                              : item.status === "watch"
                                ? "bg-amber-500/15 text-amber-200"
                                : "bg-emerald-500/15 text-emerald-200",
                          ].join(" ")}
                        >
                          {item.status}
                        </span>
                      </div>

                      <div className="mt-4 flex items-center justify-between text-sm text-white/65">
                        <span>Tracked</span>
                        <span>{formatHours(item.trackedHours)}</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-orange-500"
                          style={{
                            width: `${Math.min((item.trackedHours / item.plannedHours) * 100, 100)}%`,
                          }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-white/35">
                        Planned capacity {formatHours(item.plannedHours)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-orange-500/15 p-3 text-orange-300">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">AI workflows</h2>
                    <p className="text-sm text-white/50">
                      Ready-made prompts for planning, reporting, and time
                      saving.
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {social.aiPrompts.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4"
                    >
                      <h3 className="font-semibold text-white">{item.title}</h3>
                      <p className="mt-2 text-sm text-white/50">
                        {item.description}
                      </p>
                      <button
                        type="button"
                        onClick={() => setGeneratedPrompt(item.prompt)}
                        className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-orange-500/20 bg-orange-500/10 px-3 py-2 text-sm font-medium text-orange-100 transition hover:bg-orange-500/15"
                      >
                        Use prompt
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="mt-6 grid gap-6 2xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 lg:p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-orange-500/15 p-3 text-orange-300">
                  <CalendarDays size={18} />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Calendar pulse</h2>
                  <p className="text-sm text-white/50">
                    A near-term publishing view for daily standups and planning.
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <CalendarView items={social.queue} />
              </div>
            </div>

            <div className="space-y-6">
              <SocialPostForm
                clients={social.clients}
                campaigns={social.campaigns}
                onGenerate={setGeneratedPrompt}
              />

              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">
                      Generated AI prompt
                    </h2>
                    <p className="mt-1 text-sm text-white/50">
                      Feed this into the assistant for strategy, post drafts, or
                      workflow analysis.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCopyPrompt()}
                    disabled={!generatedPrompt}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-white transition hover:border-orange-500/30 disabled:opacity-50"
                  >
                    <Copy size={14} />
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>

                <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm leading-7 text-white/75">
                  {generatedPrompt ||
                    "Pick an AI workflow or build a brief to generate a focused social media prompt."}
                </div>
              </div>
            </div>
          </section>

          <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5 lg:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  Team capacity and AI support
                </h2>
                <p className="mt-1 text-sm text-white/50">
                  Use the assistant to plan around real workload instead of
                  piling work into approvals and revisions.
                </p>
              </div>
              <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 px-4 py-3 text-sm text-orange-100">
                Billable time in period:{" "}
                {formatHours(social.metrics.billableHours)}
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-4">
              {social.teamCapacity.map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-white/10 bg-black/30 p-4"
                >
                  <p className="text-sm font-semibold text-white">
                    {item.label}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-white">
                    {formatHours(item.allocatedHours)}
                  </p>
                  <p className="mt-1 text-sm text-white/45">
                    Planned {formatHours(item.plannedHours)}
                  </p>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-orange-500"
                      style={{
                        width: `${Math.min(item.utilization * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-2xl bg-orange-500/15 p-3 text-orange-300">
                <Sparkles size={18} />
              </div>
              <div>
                <h2 className="text-xl font-semibold">
                  Embedded social AI assistant
                </h2>
                <p className="text-sm text-white/50">
                  Ask for content ideas, client updates, repurposing plans,
                  workload optimisation, or automation recommendations.
                </p>
              </div>
            </div>

            <AiChatPanel context={aiContext} />
          </section>
        </main>
      </div>
    </div>
  );
}
