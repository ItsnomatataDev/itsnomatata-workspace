import { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  Clock3,
  LayoutGrid,
  MessageSquare,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../app/providers/AuthProvider";
import { buildAssistantContext } from "../../../lib/api/ai";
import AIActionHistoryList from "../components/AIActionHistoryList";
import AIActionLauncher from "../components/AIActionLauncher";
import RealTimeChat from "../components/RealTimeChat";
import AIOutputPreview from "../components/AIOutputPreview";
import AIQuickSearch from "../components/AIQuickSearch";
import AIRequestForm from "../components/AIRequestForm";
import AIWorkspaceHeader from "../components/AIWorkspaceHeader";
import EmptyAIState from "../components/EmptyAIState";
import FavoriteToolsPanel from "../components/FavoriteToolsPanel";
import PendingApprovalsPanel from "../components/PendingApprovalsPanel";
import RecentOutputsPanel from "../components/RecentOutputsPanel";
import RoleToolSection from "../components/RoleToolSection";
import { useAIWorkspace } from "../hooks/useAIWorkspace";
import type { AIWorkspaceViewMode } from "../types/aiWorkspace";

// ── Extended view mode to include chat ────────────────────
type ExtendedViewMode = AIWorkspaceViewMode | "chat";

function formatRoleLabel(role: string | null | undefined) {
  if (!role) return "Employee";
  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function humanizeLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

const VIEW_OPTIONS: Array<{
  id: ExtendedViewMode;
  label: string;
  icon: ComponentType<{ size?: number }>;
}> = [
  { id: "overview", label: "Overview", icon: Sparkles },
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "tool", label: "Tools", icon: LayoutGrid },
  { id: "history", label: "History", icon: Clock3 },
  { id: "approvals", label: "Approvals", icon: ShieldCheck },
];

function MetricCard({
  title,
  value,
  helper,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  helper: string;
  icon: ComponentType<{ size?: number }>;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-white/60">{title}</p>
          <p className="mt-2 text-3xl font-bold text-white">{value}</p>
        </div>

        <div className="rounded-2xl bg-orange-500/15 p-3 text-orange-400">
          <Icon size={18} />
        </div>
      </div>

      <p className="mt-3 text-xs text-white/45">{helper}</p>
    </div>
  );
}

export default function AIWorkspacePage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const profile = auth?.profile ?? null;
  const user = auth?.user ?? null;

  const context = useMemo(
    () =>
      buildAssistantContext({
        userId: user?.id ?? "workspace-user",
        fullName: profile?.full_name ?? "Workspace User",
        email: user?.email ?? null,
        role: profile?.primary_role ?? "employee",
        department:
          typeof profile?.department === "string" ? profile.department : null,
        organizationId: profile?.organization_id ?? null,
        currentRoute: "/ai-workspace",
        currentModule: "ai-workspace",
        timezone: "Africa/Harare",
        channel: "web",
      }),
    [
      profile?.department,
      profile?.full_name,
      profile?.organization_id,
      profile?.primary_role,
      user?.email,
      user?.id,
    ],
  );

  const {
    loading,
    running,
    tools,
    featuredTools,
    recentOutputs,
    history,
    pendingApprovals,
    error,
    groupedTools,
    viewMode,
    selectedToolId,
    setViewMode,
    selectTool,
    runTool,
    askAssistant,
    handleApprovalReview,
  } = useAIWorkspace({
    context,
    role: profile?.primary_role ?? "employee",
  });

  // Extended view mode includes "chat" which the hook doesn't know about
  const [extendedViewMode, setExtendedViewMode] =
    useState<ExtendedViewMode>("overview");

  // Keep hook's viewMode in sync for non-chat views
  const handleSetViewMode = (mode: ExtendedViewMode) => {
    setExtendedViewMode(mode);
    if (mode !== "chat") {
      setViewMode(mode as AIWorkspaceViewMode);
    }
  };

  const [selectedOutputId, setSelectedOutputId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedToolId) {
      const nextToolId = featuredTools[0]?.id ?? tools[0]?.id ?? null;
      if (nextToolId) {
        selectTool(nextToolId);
      }
    }
  }, [featuredTools, selectTool, selectedToolId, tools]);

  useEffect(() => {
    if (!selectedOutputId && recentOutputs[0]?.id) {
      setSelectedOutputId(recentOutputs[0].id);
    }
  }, [recentOutputs, selectedOutputId]);

  const roleLabel = useMemo(
    () => formatRoleLabel(profile?.primary_role),
    [profile?.primary_role],
  );

  const selectedTool = useMemo(
    () => tools.find((tool) => tool.id === selectedToolId) ?? null,
    [selectedToolId, tools],
  );

  const selectedOutput = useMemo(
    () =>
      recentOutputs.find((output) => output.id === selectedOutputId) ?? null,
    [recentOutputs, selectedOutputId],
  );

  const approvalTools = useMemo(
    () => tools.filter((tool) => tool.requiresApproval),
    [tools],
  );

  const handleRunTool = async (params: { toolId: string; prompt?: string }) => {
    const output = await runTool({
      ...params,
      metadata: {
        source: "ai_workspace_page",
        role: profile?.primary_role ?? "employee",
      },
    });

    setSelectedOutputId(output.id);
    handleSetViewMode("overview");
  };

  const handleQuickSearch = async (query: string) => {
    const output = await askAssistant(query);
    setSelectedOutputId(output.id);
    handleSetViewMode("overview");
  };

  const handlePromptSubmit = async ({ prompt }: { prompt: string }) => {
    if (selectedTool) {
      await handleRunTool({
        toolId: selectedTool.id,
        prompt,
      });
      return;
    }

    await handleQuickSearch(prompt);
  };


  const handleChatAsk = async (prompt: string) => {
    try {
      // Handle the chat request
      const output = await askAssistant(prompt);
      return { content: output.content };
    } catch (error) {
      console.error("Chat AI service error:", error);
      return { 
        content: "I'm having trouble connecting right now. Please try again in a moment." 
      };
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="space-y-6 p-4 md:p-6 lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#050505] px-4 py-3">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
          >
            <ArrowLeft size={16} />
            Back to Main Dashboard
          </button>

          <p className="text-xs uppercase tracking-[0.24em] text-white/45">
            Workspace AI Control Center
          </p>
        </div>

        <AIWorkspaceHeader
          title="AI Workspace"
          subtitle="A role-aware command center for tasks, reports, documents, automation, and smart workspace support."
          role={roleLabel}
          userName={profile?.full_name ?? user?.email ?? "Workspace User"}
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Available Tools"
            value={tools.length}
            helper="Role-based AI actions ready to use"
            icon={Sparkles}
          />
          <MetricCard
            title="Featured Tools"
            value={featuredTools.length}
            helper="Recommended shortcuts for this role"
            icon={Bot}
          />
          <MetricCard
            title="Recent Outputs"
            value={recentOutputs.length}
            helper="Latest AI summaries and generated content"
            icon={CheckCircle2}
          />
          <MetricCard
            title="Pending Approvals"
            value={pendingApprovals.length}
            helper="Approval-aware requests waiting for review"
            icon={ShieldCheck}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {VIEW_OPTIONS.map(({ id, label, icon: Icon }) => {
            const active = extendedViewMode === id;
            const isChat = id === "chat";

            return (
              <button
                key={id}
                type="button"
                onClick={() => handleSetViewMode(id)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                  active
                    ? isChat
                      ? "bg-linear-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/20"
                      : "bg-orange-500 text-white"
                    : "border border-white/10 bg-white/5 text-gray-200 hover:bg-white/10"
                }`}
              >
                <Icon size={16} />
                {label}
                {isChat && !active && (
                  <span className="ml-0.5 rounded-full bg-orange-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-orange-400">
                    New
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
            Loading your AI workspace...
          </div>
        ) : tools.length === 0 ? (
          <EmptyAIState
            title="No AI tools available yet"
            description="Assign a role to this user or configure the AI catalog to unlock workspace actions and guided assistants."
          />
        ) : (
          <>
       
            {extendedViewMode === "chat" && (
              <RealTimeChat
                busy={running}
                userName={profile?.full_name ?? user?.email ?? null}
                role={roleLabel}
                onAsk={handleChatAsk}
              />
            )}
            {extendedViewMode === "overview" && (
              <div className="grid gap-4 xl:grid-cols-3">
                <div className="space-y-4 xl:col-span-2">
                  <AIQuickSearch busy={running} onSearch={handleQuickSearch} />

                  <FavoriteToolsPanel
                    tools={featuredTools}
                    selectedToolId={selectedToolId}
                    onSelect={selectTool}
                  />

                  <div className="grid gap-4 lg:grid-cols-2">
                    <AIActionLauncher
                      tool={selectedTool}
                      busy={running}
                      onRun={handleRunTool}
                    />
                    <AIRequestForm
                      tool={selectedTool}
                      busy={running}
                      onSubmit={handlePromptSubmit}
                    />
                  </div>

                  <RoleToolSection
                    title="Featured AI tools"
                    description="Start with the most relevant actions for your current role and workspace context."
                    tools={
                      featuredTools.length ? featuredTools : tools.slice(0, 6)
                    }
                    selectedToolId={selectedToolId}
                    onSelect={selectTool}
                  />
                </div>

                <div className="space-y-4">
                  <AIOutputPreview output={selectedOutput} />
                  <RecentOutputsPanel
                    outputs={recentOutputs}
                    selectedOutputId={selectedOutputId}
                    onSelect={(output) => setSelectedOutputId(output.id)}
                  />
                </div>
              </div>
            )}
            {extendedViewMode === "tool" && (
              <div className="grid gap-4 xl:grid-cols-3">
                <div className="space-y-6 xl:col-span-2">
                  {Object.entries(groupedTools).map(([category, items]) => (
                    <RoleToolSection
                      key={category}
                      title={humanizeLabel(category)}
                      description={`AI actions for ${humanizeLabel(category).toLowerCase()} work in this system.`}
                      tools={items}
                      selectedToolId={selectedToolId}
                      onSelect={selectTool}
                    />
                  ))}
                </div>

                <div className="space-y-4">
                  <AIActionLauncher
                    tool={selectedTool}
                    busy={running}
                    onRun={handleRunTool}
                  />
                  <AIRequestForm
                    tool={selectedTool}
                    busy={running}
                    onSubmit={handlePromptSubmit}
                  />
                </div>
              </div>
            )}
            {extendedViewMode === "history" && (
              <div className="grid gap-4 xl:grid-cols-3">
                <div className="space-y-4 xl:col-span-2">
                  <AIActionHistoryList items={history} />
                  <RecentOutputsPanel
                    outputs={recentOutputs}
                    selectedOutputId={selectedOutputId}
                    onSelect={(output) => setSelectedOutputId(output.id)}
                  />
                </div>

                <div className="space-y-4">
                  <AIOutputPreview output={selectedOutput} />
                </div>
              </div>
            )}
            {extendedViewMode === "approvals" && (
              <div className="grid gap-4 xl:grid-cols-3">
                <div className="space-y-4 xl:col-span-2">
                  <PendingApprovalsPanel
                    items={pendingApprovals}
                    busy={running}
                    onApprove={(id) => handleApprovalReview(id, "approved")}
                    onReject={(id) => handleApprovalReview(id, "rejected")}
                  />
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <h3 className="text-base font-semibold text-white">
                      Approval-aware tools
                    </h3>
                    <p className="mt-1 text-sm text-gray-400">
                      These actions will create review items before anything is
                      finalized.
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {approvalTools.length === 0 ? (
                        <p className="text-sm text-gray-400">
                          No approval-gated tools for this role.
                        </p>
                      ) : (
                        approvalTools.map((tool) => (
                          <button
                            key={tool.id}
                            type="button"
                            onClick={() => selectTool(tool.id)}
                            className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200"
                          >
                            {tool.label}
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  <AIActionLauncher
                    tool={selectedTool}
                    busy={running}
                    onRun={handleRunTool}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
