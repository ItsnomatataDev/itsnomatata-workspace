import AiChatPanel from "../components/AiChatPanel";
import type { AssistantContextInput } from "../../../lib/api/n8n";

export default function AiAssistantPage() {
  const context: AssistantContextInput = {
    userId: "current-user",
    fullName: "Workspace User",
    email: null,
    role: "employee",
    department: null,
    organizationId: null,
    currentRoute: "/ai-assistant",
    currentModule: "ai-assistant",
    timezone: "Africa/Harare",
    channel: "web",
  };

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
