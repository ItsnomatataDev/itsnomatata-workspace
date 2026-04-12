import { useMemo } from "react";
import { useAuth } from "../../../app/providers/AuthProvider";
import type { AssistantContextInput } from "../../../lib/api/n8n";
import AiChatPanel from "../components/AiChatPanel";

export default function AiAssistantPage() {
  const auth = useAuth();
  const profile = auth?.profile ?? null;
  const user = auth?.user ?? null;

  const context = useMemo<AssistantContextInput>(
    () => ({
      userId: user?.id ?? "current-user",
      fullName: profile?.full_name ?? "Workspace User",
      email: user?.email ?? null,
      role: profile?.primary_role ?? "employee",
      department:
        typeof profile?.department === "string" ? profile.department : null,
      organizationId: profile?.organization_id ?? null,
      currentRoute: "/ai-assistant",
      currentModule: "ai-assistant",
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

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-white">AI Assistant</h1>
        <p className="mt-1 text-sm text-gray-400">
          Your role-aware workspace assistant for tasks, documents, reports, and
          workflow support.
        </p>
      </div>

      <AiChatPanel context={context} />
    </div>
  );
}
