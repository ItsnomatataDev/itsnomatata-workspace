import {
  AI_ACTION_CATALOG,
  type AIRole,
  type AIWorkspaceAction,
  getFeaturedActions,
} from "./actionCatalog";

export function getToolsForRole(role?: string | null): AIWorkspaceAction[] {
  if (!role) return [];

  return AI_ACTION_CATALOG.filter((tool) =>
    tool.allowedRoles.includes(role as AIRole),
  );
}

export function getFeaturedToolsForRole(
  role?: string | null,
): AIWorkspaceAction[] {
  if (!role) return [];

  return getFeaturedActions().filter((tool) =>
    tool.allowedRoles.includes(role as AIRole),
  );
}

export function getToolsForRoleByCategory(
  role: string | null | undefined,
  category: AIWorkspaceAction["category"],
): AIWorkspaceAction[] {
  if (!role) return [];

  return AI_ACTION_CATALOG.filter(
    (tool) =>
      tool.category === category && tool.allowedRoles.includes(role as AIRole),
  );
}

export function canRoleUseTool(
  role: string | null | undefined,
  actionId: string,
): boolean {
  if (!role) return false;

  const tool = AI_ACTION_CATALOG.find((item) => item.id === actionId);
  if (!tool) return false;

  return tool.allowedRoles.includes(role as AIRole);
}

export function groupToolsByCategory(
  tools: AIWorkspaceAction[],
): Record<string, AIWorkspaceAction[]> {
  return tools.reduce<Record<string, AIWorkspaceAction[]>>((acc, tool) => {
    if (!acc[tool.category]) {
      acc[tool.category] = [];
    }

    acc[tool.category].push(tool);
    return acc;
  }, {});
}
