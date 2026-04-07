// src/features/ai-workspace/pages/AIWorkspacePage.tsx

import { useMemo, useState } from "react";
import AIActionHistoryList from "../components/AIActionHistoryList";
import AIActionLauncher from "../components/AIActionLauncher";
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
import type { AssistantContextInput } from "../../../lib/api/n8n";
import type { AIWorkspaceOutput } from "../types/aiWorkspace";

export default function AIWorkspacePage() {
  const context: AssistantContextInput = {
    userId: "current-user",
    fullName: "Workspace User",
    email: null,
    role: "employee",
    department: null,
    organizationId: null,
    currentRoute: "/ai-workspace",
    currentModule: "ai-workspace",
    timezone: "Africa/Harare",
    channel: "web",
  };

  const {
    loading,
    running,
    tools,
    featuredTools,
    recentOutputs,
    history,
    pendingApprovals,
    error,
    selectedToolId,
    selectTool,
    runTool,
    askAssistant,
    groupedTools,
  } = useAIWorkspace({
    context,
    role: context.role,
  });

  const [selectedOutput, setSelectedOutput] =
    useState<AIWorkspaceOutput | null>(null);

  const selectedTool = useMemo(() => {
    return (
      tools.find((tool) => tool.id === selectedToolId) ||
      featuredTools[0] ||
      tools[0] ||
      null
    );
  }, [featuredTools, selectedToolId, tools]);

  const hasAnyData =
    tools.length > 0 ||
    featuredTools.length > 0 ||
    recentOutputs.length > 0 ||
    history.length > 0;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <AIWorkspaceHeader role={context.role} userName={context.fullName} />

      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <AIQuickSearch
        busy={running}
        onSearch={async (query) => {
          const output = await askAssistant(query);
          setSelectedOutput(output);
        }}
      />

      <FavoriteToolsPanel
        tools={featuredTools}
        selectedToolId={selectedToolId}
        onSelect={selectTool}
      />

      {!loading && !hasAnyData ? (
        <EmptyAIState />
      ) : (
        <>
          <RoleToolSection
            title="Featured tools"
            description="Quick access to the most useful AI tools for your role."
            tools={featuredTools.length ? featuredTools : tools}
            selectedToolId={selectedToolId}
            onSelect={selectTool}
          />

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-gray-400">
              Loading AI tools...
            </div>
          ) : (
            <RoleToolSection
              title="All tools"
              description="Browse and launch any available AI action."
              tools={tools}
              selectedToolId={selectedToolId}
              onSelect={selectTool}
            />
          )}

          {Object.entries(groupedTools)
            .filter(([category, categoryTools]) => {
              if (category === "chat") return false;
              if (featuredTools.some((tool) => tool.category === category))
                return false;
              return categoryTools.length > 0;
            })
            .map(([category, categoryTools]) => (
              <RoleToolSection
                key={category}
                title={`${category.charAt(0).toUpperCase()}${category.slice(1)} tools`}
                description={`Browse ${category} AI tools available in your workspace.`}
                tools={categoryTools}
                selectedToolId={selectedToolId}
                onSelect={selectTool}
              />
            ))}

          <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="space-y-6">
              <AIActionLauncher
                tool={selectedTool}
                busy={running}
                onRun={async ({ toolId, prompt }) => {
                  const output = await runTool({ toolId, prompt });
                  setSelectedOutput(output);
                }}
              />

              <AIRequestForm
                tool={selectedTool}
                busy={running}
                onSubmit={async ({ prompt }) => {
                  if (selectedTool) {
                    const output = await runTool({
                      toolId: selectedTool.id,
                      prompt,
                    });
                    setSelectedOutput(output);
                    return;
                  }

                  const output = await askAssistant(prompt);
                  setSelectedOutput(output);
                }}
              />

              <PendingApprovalsPanel items={pendingApprovals} />
              <AIActionHistoryList items={history} />
            </div>

            <div className="space-y-6">
              <AIOutputPreview
                output={selectedOutput || recentOutputs[0] || null}
              />

              <RecentOutputsPanel
                outputs={recentOutputs}
                selectedOutputId={selectedOutput?.id ?? null}
                onSelect={setSelectedOutput}
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
