import { canUseAI } from "../../../lib/helpers/permissions";
import type { AiRouterContext } from "../types/aiToolTypes";

type AuthProfileLike = {
  id?: string | null;
  organization_id?: string | null;
  primary_role?: string | null;
  full_name?: string | null;
  department?: string | null;
};

export function canShowFloatingAiAssistant(params: {
  role: unknown;
  aiWorkspaceEnabled: boolean;
  isAuthenticated: boolean;
}): boolean {
  if (!params.isAuthenticated) return false;
  if (!params.aiWorkspaceEnabled) return false;
  return canUseAI(params.role);
}

export function buildAiRouterContext(
  profile: AuthProfileLike | null | undefined,
  extras?: Partial<AiRouterContext>,
): AiRouterContext | null {
  if (!profile?.id || !profile.organization_id) return null;

  return {
    userId: profile.id,
    organizationId: profile.organization_id,
    role: profile.primary_role ?? null,
    fullName: profile.full_name ?? null,
    department: profile.department ?? null,
    currentRoute: extras?.currentRoute ?? window.location.pathname,
    currentModule: extras?.currentModule ?? null,
  };
}
