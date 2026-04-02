import { useMemo, useState } from "react";
import type {
  AIActionDefinition,
  AIActionFormValues,
} from "../types/aiWorkspace";
import { useAIWorkspace } from "../hooks/useAIWorkspace";
import { groupActionsByModule } from "../utils/roleTools";
import AIWorkspaceHeader from "../components/AIWorkspaceHeader";
import AIQuickSearch from "../components/AIQuickSearch";
import EmptyAIState from "../components/EmptyAIState";
import RoleToolSection from "../components/RoleToolSection";
import AIRequestForm from "../components/AIRequestForm";
import AIOutputPreview from "../components/AIOutputPreview";
import AIActionHistoryList from "../components/AIActionHistoryList";
import PendingApprovalsPanel from "../components/PendingApprovalsPanel";
import FavoriteToolsPanel from "../components/FavoriteToolsPanel";
import RecentOutputsPanel from "../components/RecentOutputsPanel";

export default function AIWorkspacePage() {
  const {
    actions,
    recentActivity,
    pendingApprovalsCount,
    isLoading,
    isSubmitting,
    error,
    lastResponse,
    submitAction,
  } = useAIWorkspace();

  const [search, setSearch] = useState("");
  const [selectedAction, setSelectedAction] =
    useState<AIActionDefinition | null>(null);

  const filteredActions = useMemo(() => {
    if (!search.trim()) return actions;

    const query = search.toLowerCase();
    return actions.filter((action) => {
      return (
        action.title.toLowerCase().includes(query) ||
        action.description.toLowerCase().includes(query) ||
        action.module.toLowerCase().includes(query) ||
        action.actionType.toLowerCase().includes(query)
      );
    });
  }, [actions, search]);

  const groupedActions = useMemo(
    () => groupActionsByModule(filteredActions),
    [filteredActions],
  );

  async function handleSubmit(values: AIActionFormValues) {
    if (!selectedAction) return;

    await submitAction({
      module: selectedAction.module,
      actionType: selectedAction.actionType,
      entityId: values.entityId || undefined,
      entityType: values.entityType || selectedAction.entityType || undefined,
      input: {
        prompt: values.prompt || undefined,
        instructions: values.instructions || undefined,
        entityId: values.entityId || undefined,
        entityType: values.entityType || selectedAction.entityType || undefined,
        metadata: {
          source: "ai-workspace",
          actionId: selectedAction.id,
          requiresApproval: selectedAction.requiresApproval ?? false,
        },
      },
    });
  }

  return (
    <div className="space-y-6">
      <AIWorkspaceHeader />

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <AIQuickSearch value={search} onChange={setSearch} />
        </div>
        <PendingApprovalsPanel count={pendingApprovalsCount} />
      </div>

      <FavoriteToolsPanel
        tools={actions.slice(0, 4)}
        onLaunch={setSelectedAction}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <div className="space-y-6">
          {isLoading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/65">
              Loading AI workspace...
            </div>
          ) : filteredActions.length === 0 ? (
            <EmptyAIState />
          ) : (
            Object.entries(groupedActions).map(([module, moduleActions]) => (
              <RoleToolSection
                key={module}
                title={module}
                actions={moduleActions}
                onLaunch={setSelectedAction}
              />
            ))
          )}
        </div>

        <div className="space-y-6">
          <AIRequestForm
            action={selectedAction}
            isSubmitting={isSubmitting}
            onSubmit={handleSubmit}
          />
          <AIOutputPreview response={lastResponse} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <AIActionHistoryList items={recentActivity} />
        <RecentOutputsPanel items={recentActivity} />
      </div>
    </div>
  );
}
