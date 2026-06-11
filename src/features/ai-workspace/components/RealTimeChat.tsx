import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUp,
  Copy,
  Download,
  FileText,
  Folder,
  Image as ImageIcon,
  Loader2,
  Menu,
  Mic,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { useAuth } from "../../../app/providers/AuthProvider";
import {
  ChatHistoryService,
  type ChatAttachment,
  type ChatConversation,
  type ChatMessage,
} from "../services/chatHistoryService";
import { ImageUploadService } from "../services/imageUploadService";
import { uploadCodexChatFile } from "../services/codexAttachmentService";
import {
  AIProjectService,
  type AIWorkspaceProject,
} from "../services/aiProjectService";
import { uploadAIDocument } from "../../../lib/api/ai";

interface RealTimeChatProps {
  busy: boolean;
  userName?: string | null;
  role?: string | null;
  onAsk: (
    prompt: string,
    attachments?: ChatAttachment[],
    metadata?: Record<string, unknown>,
  ) => Promise<{ content: string; attachments?: ChatAttachment[] }>;
  initialConversationId?: string;
  onBack?: () => void;
}

type PendingAttachment = {
  id: string;
  file: File;
  type: ChatAttachment["type"];
  previewUrl?: string;
};

type LocalChatMessage = ChatMessage & {
  pending?: boolean;
  error?: boolean;
};

const CHAT_STARTERS = [
  {
    label: "Plan work",
    prompt: "Help me plan the most important work for today.",
  },
  {
    label: "Summarize",
    prompt: "Summarize the latest work and decisions in this workspace.",
  },
  {
    label: "Find risks",
    prompt: "Review my current work and point out risks or blockers.",
  },
  {
    label: "Draft update",
    prompt: "Draft a clean internal update for the team.",
  },
];

function makeId(prefix = "chat") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function formatTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatConversationDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

function getConversationSection(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Older";

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfToday.getDate() - 1);

  const startOfLastWeek = new Date(startOfToday);
  startOfLastWeek.setDate(startOfToday.getDate() - 7);

  const startOfLastMonth = new Date(startOfToday);
  startOfLastMonth.setDate(startOfToday.getDate() - 30);

  if (date >= startOfToday) return "Today";
  if (date >= startOfYesterday) return "Yesterday";
  if (date >= startOfLastWeek) return "Previous 7 days";
  if (date >= startOfLastMonth) return "Previous 30 days";
  return "Older";
}

function formatFileSize(bytes: number) {
  if (!bytes) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );

  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function attachmentUrl(attachment: ChatAttachment) {
  return attachment.downloadUrl || attachment.download_url || attachment.url;
}

function getLoadingLabel(prompt: string, attachments: PendingAttachment[] = []) {
  const text = prompt.toLowerCase();

  if (/\b(image|picture|poster|logo|visual|creative|draw|photo)\b/.test(text)) {
    return "Generating image...";
  }
  if (/\b(pdf|csv|export|download|file)\b/.test(text)) {
    return "Preparing file...";
  }
  if (attachments.some((item) => item.type === "document")) {
    return "Reading document...";
  }
  if (/\b(search|find|lookup|documents?|knowledge)\b/.test(text)) {
    return "Searching workspace...";
  }

  return "Thinking...";
}

function getAttachmentType(file: File): ChatAttachment["type"] {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("video/")) return "video";
  return "document";
}

function AttachmentIcon({ type }: { type: ChatAttachment["type"] }) {
  if (type === "image") return <ImageIcon size={14} />;
  if (type === "audio") return <Mic size={14} />;
  if (type === "video") return <Video size={14} />;
  return <FileText size={14} />;
}

function isBrowserUrl(url?: string) {
  return !!url && (/^(https?:|blob:|data:)/i.test(url) || url.startsWith("/"));
}

function MessageContent({ content }: { content: string }) {
  const parts: Array<
    | { type: "text"; value: string }
    | { type: "link"; label: string; url: string; downloadable: boolean }
  > = [];
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(content)) !== null) {
    if (match.index > cursor) {
      parts.push({ type: "text", value: content.slice(cursor, match.index) });
    }

    const url = match[2] ?? "";
    parts.push({
      type: "link",
      label: match[1] ?? url,
      url,
      downloadable: isBrowserUrl(url),
    });
    cursor = match.index + match[0].length;
  }

  if (cursor < content.length) {
    parts.push({ type: "text", value: content.slice(cursor) });
  }

  if (!parts.length) return <>{content}</>;

  return (
    <>
      {parts.map((part, index) => {
        if (part.type === "text") {
          return <span key={index}>{part.value}</span>;
        }

        if (!part.downloadable) {
          return (
            <span
              key={index}
              className="rounded-md border border-amber-400/20 bg-amber-400/10 px-1.5 py-0.5 text-amber-200"
              title={`${part.url} is not a browser-downloadable URL`}
            >
              {part.label} unavailable - no real download URL
            </span>
          );
        }

        return (
          <a
            key={index}
            href={part.url}
            target={part.url.startsWith("/") ? undefined : "_blank"}
            rel={part.url.startsWith("/") ? undefined : "noreferrer"}
            download={part.url.startsWith("/") ? undefined : true}
            className="font-medium text-[#8ab4ff] underline decoration-white/20 underline-offset-4 hover:text-white"
          >
            {part.label}
          </a>
        );
      })}
    </>
  );
}

function MessageAttachments({
  attachments,
  onRegenerateImage,
}: {
  attachments?: ChatAttachment[];
  onRegenerateImage?: () => void;
}) {
  if (!attachments?.length) return null;

  return (
    <div className="mt-3 grid gap-3">
      {attachments.map((attachment) => {
        const url = attachmentUrl(attachment);
        const canOpen = isBrowserUrl(url);

        if (attachment.type === "image") {
          return (
            <figure
              key={attachment.id}
              className="w-full max-w-[min(420px,100%)] overflow-hidden rounded-2xl border border-white/10 bg-[#171717] shadow-[0_18px_70px_rgba(0,0,0,0.25)]"
            >
              {canOpen ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="block bg-black/30"
                  aria-label={`Open ${attachment.name}`}
                >
                  <img
                    src={url}
                    alt={attachment.name}
                    className="aspect-square w-full object-cover"
                    loading="lazy"
                  />
                </a>
              ) : (
                <div className="flex aspect-square w-full items-center justify-center bg-white/5 text-sm text-white/45">
                  Image unavailable
                </div>
              )}

              <figcaption className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-3 py-2.5">
                <span className="min-w-0 truncate text-xs text-white/52">
                  {attachment.name}
                </span>
                <span className="flex items-center gap-1.5">
                  {canOpen && (
                    <a
                      href={url}
                      download={attachment.name}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-white/65 transition hover:bg-white/10 hover:text-white"
                    >
                      <Download size={14} />
                      Download
                    </a>
                  )}
                  {onRegenerateImage && (
                    <button
                      type="button"
                      onClick={onRegenerateImage}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-white/65 transition hover:bg-white/10 hover:text-white"
                    >
                      <RefreshCw size={14} />
                      Redo
                    </button>
                  )}
                </span>
              </figcaption>
            </figure>
          );
        }

        return (
          <a
            key={attachment.id}
            href={canOpen ? url : undefined}
            target="_blank"
            rel="noreferrer"
            download
            aria-disabled={!canOpen}
            className={`group flex max-w-sm items-center gap-3 rounded-xl border border-white/10 bg-white/4 p-2 text-left transition ${
              canOpen
                ? "hover:bg-white/[0.07]"
                : "cursor-not-allowed opacity-60"
            }`}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-md bg-white/8 text-white/60">
              <AttachmentIcon type={attachment.type} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-medium text-white">
                {attachment.name}
              </span>
              <span className="text-[11px] text-white/45">
                {canOpen
                  ? formatFileSize(attachment.size)
                  : "No real download URL returned"}
              </span>
            </span>
          </a>
        );
      })}
    </div>
  );
}

function MessageBubble({
  message,
  onDelete,
  onRegenerateImage,
}: {
  message: LocalChatMessage;
  onDelete?: (messageId: string) => void;
  onRegenerateImage?: (messageId: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  if (message.pending) {
    return (
      <div className="flex justify-start">
        <div className="rounded-2xl px-1 py-3">
          <div className="flex items-center gap-2 text-sm text-white/60">
            <Loader2 size={14} className="animate-spin text-white/50" />
            {message.content || "Thinking..."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`group max-w-[min(760px,86%)] ${isUser ? "order-1" : ""}`}>
        <div
          className={`px-4 py-3 text-[15px] leading-7 ${
            isUser
              ? "rounded-3xl bg-[#303030] text-white"
              : message.error
                ? "rounded-2xl border border-red-500/20 bg-red-500/10 text-red-200"
                : "text-white/88"
          }`}
        >
          <div className="whitespace-pre-wrap">
            {message.error
              ? message.content || "Something went wrong while getting the response. Please try again."
              : <MessageContent content={message.content || "Attached file"} />}
          </div>
          <MessageAttachments
            attachments={message.attachments}
            onRegenerateImage={
              !isUser && message.attachments?.some((item) => item.type === "image")
                ? () => onRegenerateImage?.(message.id)
                : undefined
            }
          />
        </div>

        <div
          className={`mt-1 flex items-center gap-2 px-2 text-[11px] text-white/28 ${
            isUser ? "justify-end" : "justify-start"
          }`}
        >
          <span>{formatTime(message.createdAt)}</span>
          {!message.error && (
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 opacity-0 transition group-hover:opacity-100 hover:text-white/70"
            >
              <Copy size={10} />
              {copied ? "Copied" : "Copy"}
            </button>
          )}
          {isUser && onDelete && (
            <button
              type="button"
              onClick={() => onDelete(message.id)}
              className="opacity-0 transition group-hover:opacity-100 hover:text-red-300"
              aria-label="Delete message"
            >
              <Trash2 size={10} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ChatSidebar({
  projects,
  selectedProjectId,
  conversations,
  activeConversationId,
  searchQuery,
  onSearch,
  onSelectProject,
  onCreateProject,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
}: {
  projects: AIWorkspaceProject[];
  selectedProjectId: string | null;
  conversations: ChatConversation[];
  activeConversationId?: string;
  searchQuery: string;
  onSearch: (query: string) => void;
  onSelectProject: (projectId: string | null) => void;
  onCreateProject: () => void;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
}) {
  const filteredConversations = conversations
    .filter((conversation) => {
      const conversationProjectId =
        typeof conversation.metadata?.projectId === "string" &&
          conversation.metadata.projectId.trim().length > 0
          ? conversation.metadata.projectId
          : null;

      if (selectedProjectId === null) {
        return conversationProjectId === null;
      }

      return conversationProjectId === selectedProjectId;
    })
    .filter((conversation) =>
      conversation.title.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  const groupedConversations = filteredConversations.reduce<
    Array<{ label: string; conversations: ChatConversation[] }>
  >((groups, conversation) => {
    const label = getConversationSection(conversation.updatedAt);
    const existingGroup = groups.find((group) => group.label === label);

    if (existingGroup) {
      existingGroup.conversations.push(conversation);
    } else {
      groups.push({ label, conversations: [conversation] });
    }

    return groups;
  }, []);

  return (
    <aside className="flex h-full w-full flex-col border-r border-white/8 bg-[#171717] md:w-73">
      <div className="border-b border-white/10 p-3">
        <button
          type="button"
          onClick={onNewConversation}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-transparent px-3 py-2.5 text-sm font-medium text-white transition hover:bg-white/8"
        >
          <Plus size={16} />
          New chat
        </button>

        <div className="mt-3 space-y-1">
          <button
            type="button"
            onClick={() => onSelectProject(null)}
            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
              selectedProjectId === null
                ? "bg-white/12 text-white"
                : "text-white/65 hover:bg-white/8"
            }`}
          >
            <Folder size={15} />
            General
          </button>

          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => onSelectProject(project.id)}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                selectedProjectId === project.id
                  ? "bg-white/12 text-white"
                  : "text-white/65 hover:bg-white/8"
              }`}
            >
              <Folder size={15} />
              <span className="truncate">{project.title}</span>
            </button>
          ))}

          <button
            type="button"
            onClick={onCreateProject}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-white/45 transition hover:bg-white/8 hover:text-white/75"
          >
            <Plus size={15} />
            New project
          </button>
        </div>

        <div className="relative mt-3">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search chats"
            className="h-10 w-full rounded-xl border border-transparent bg-white/8 pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/18"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {filteredConversations.length === 0 ? (
          <div className="rounded-lg px-3 py-6 text-center text-sm text-white/40">
            No chats yet.
          </div>
        ) : (
          groupedConversations.map((section) => (
            <div key={section.label} className="mb-4">
              <p className="mb-1 px-3 text-xs font-medium text-white/36">
                {section.label}
              </p>
              <div className="space-y-1">
                {section.conversations.map((conversation) => {
                  const active = activeConversationId === conversation.id;

                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => onSelectConversation(conversation.id)}
                      className={`group flex w-full items-start gap-2 rounded-lg px-3 py-2.5 text-left transition ${
                        active
                          ? "bg-white/12 text-white"
                          : "text-white/72 hover:bg-white/8"
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {conversation.title}
                        </span>
                        <span
                          className={`mt-0.5 block text-xs ${
                            active ? "text-white/45" : "text-white/35"
                          }`}
                        >
                          {formatConversationDate(conversation.updatedAt)}
                        </span>
                      </span>
                      <span
                        onClick={(event) => {
                          event.stopPropagation();
                          onDeleteConversation(conversation.id);
                        }}
                        className={`rounded-md p-1 opacity-0 transition group-hover:opacity-100 ${
                          active ? "hover:bg-white/10" : "hover:bg-red-500/15"
                        }`}
                        aria-label="Delete conversation"
                      >
                        <Trash2 size={13} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

export default function RealTimeChat({
  busy,
  userName,
  role,
  onAsk,
  initialConversationId,
  onBack,
}: RealTimeChatProps) {
  const [messages, setMessages] = useState<LocalChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [projects, setProjects] = useState<AIWorkspaceProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const [activeConversationId, setActiveConversationId] = useState<
    string | undefined
  >(initialConversationId);
  const [showMobileHistory, setShowMobileHistory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showStarters, setShowStarters] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<
    PendingAttachment[]
  >([]);

  const auth = useAuth();
  const userId = auth?.user?.id;
  const organizationId =
    auth?.currentOrganization?.organization_id ??
    auth?.profile?.organization_id ??
    auth?.memberships?.[0]?.organization_id ??
    null;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeConversation = useMemo(
    () =>
      conversations.find((conversation) => conversation.id === activeConversationId),
    [activeConversationId, conversations],
  );

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const loadConversations = useCallback(async () => {
    if (!userId) return;

    try {
      const result = await ChatHistoryService.getUserConversations({
        userId,
        organizationId: organizationId || undefined,
        limit: 80,
      });
      setConversations(result.conversations);
    } catch (error) {
      console.error("Error loading conversations:", error);
      setError("Failed to load conversations.");
    }
  }, [organizationId, userId]);

  const loadProjects = useCallback(async () => {
    if (!userId) return;

    const nextProjects = await AIProjectService.listProjects({
      userId,
      organizationId,
    });
    setProjects(nextProjects);
  }, [organizationId, userId]);

  const loadConversation = useCallback(
    async (conversationId: string) => {
      if (!userId) return;

      setLoading(true);
      setError(null);
      try {
        const session = await ChatHistoryService.getChatSession({
          conversationId,
          userId,
          organizationId,
          limit: 100,
        });

        const sessionProjectId =
          typeof session.conversation.metadata?.projectId === "string" &&
            session.conversation.metadata.projectId.trim().length > 0
            ? session.conversation.metadata.projectId
            : null;

        setSelectedProjectId(sessionProjectId);
        setMessages(session.messages);
        setActiveConversationId(conversationId);
        setShowStarters(false);
        setShowMobileHistory(false);
      } catch (error) {
        console.error("Error loading conversation:", error);
        setError("Failed to load this chat.");
      } finally {
        setLoading(false);
      }
    },
    [organizationId, userId],
  );

  useEffect(() => {
    void loadConversations();
    void loadProjects();
  }, [loadConversations, loadProjects]);

  useEffect(() => {
    if (initialConversationId && userId) {
      void loadConversation(initialConversationId);
    }
  }, [initialConversationId, loadConversation, userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
    textarea.style.overflowY = textarea.scrollHeight > 160 ? "auto" : "hidden";
  }, [input]);

  const createNewConversation = async () => {
    if (!userId) return;
    if (!organizationId) {
      setError("Your organization is still loading. Please try again in a moment.");
      return;
    }

    try {
      const conversation = await ChatHistoryService.createConversation({
        userId,
        organizationId,
        title: "New Chat",
        role: role || undefined,
        projectId: selectedProjectId,
        projectName: selectedProject?.title ?? null,
      });

      setConversations((prev) => [conversation, ...prev]);
      setActiveConversationId(conversation.id);
      setMessages([]);
      setInput("");
      setPendingAttachments([]);
      setShowStarters(true);
      setShowMobileHistory(false);
      setError(null);
    } catch (error) {
      console.error("Error creating conversation:", error);
      setError("Failed to create a new chat.");
    }
  };

  const createProject = async () => {
    if (!userId) return;
    if (!organizationId) {
      setError("Your organization is still loading. Please try again in a moment.");
      return;
    }

    const title = newProjectTitle.trim();
    if (!title) return;

    setCreatingProject(true);
    try {
      const project = await AIProjectService.createProject({
        userId,
        organizationId,
        title,
        description: newProjectDescription.trim() || null,
      });
      setProjects((prev) => [project, ...prev]);
      setSelectedProjectId(project.id);
      setActiveConversationId(undefined);
      setMessages([]);
      setShowStarters(true);
      setSearchQuery("");
      setShowProjectModal(false);
      setNewProjectTitle("");
      setNewProjectDescription("");
    } catch (error) {
      console.error("Error creating AI project:", error);
      setError("Failed to create the project. Make sure the latest migration is applied.");
    } finally {
      setCreatingProject(false);
    }
  };

  const deleteConversation = async (conversationId: string) => {
    if (!userId) return;

    try {
      await ChatHistoryService.deleteConversation(conversationId);
      setConversations((prev) =>
        prev.filter((conversation) => conversation.id !== conversationId),
      );

      if (activeConversationId === conversationId) {
        setActiveConversationId(undefined);
        setMessages([]);
        setShowStarters(true);
      }
    } catch (error) {
      console.error("Error deleting conversation:", error);
      setError("Failed to delete the chat.");
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!userId) return;

    try {
      await ChatHistoryService.deleteMessage({ messageId, userId });
      setMessages((prev) => prev.filter((message) => message.id !== messageId));
    } catch (error) {
      console.error("Error deleting message:", error);
      setError("Failed to delete the message.");
    }
  };

  const handleFilesSelected = (files: FileList | null) => {
    if (!files?.length) return;

    const nextAttachments = Array.from(files).map((file) => ({
      id: makeId("file"),
      file,
      type: getAttachmentType(file),
      previewUrl: file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : undefined,
    }));

    setPendingAttachments((prev) => [...prev, ...nextAttachments]);
    setShowStarters(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removePendingAttachment = (id: string) => {
    setPendingAttachments((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
  };

  const buildChatAttachments = async (
    files: PendingAttachment[],
    messageId: string,
  ): Promise<ChatAttachment[]> => {
    const attachments: ChatAttachment[] = [];

    for (const pending of files) {
      if (pending.type === "image") {
        try {
          const upload = await ImageUploadService.uploadImage(pending.file);
          attachments.push({
            id: makeId("attachment"),
            messageId,
            type: "image",
            name: pending.file.name,
            url: upload.url,
            download_url: upload.url,
            downloadUrl: upload.url,
            size: upload.size,
            mimeType: upload.mimeType,
            uploadedAt: nowIso(),
            metadata: upload.metadata,
          });
          continue;
        } catch (error) {
          console.warn("Image upload failed, using local preview:", error);
        }
      }

      if (pending.type === "document") {
        try {
          const codexUpload = await uploadCodexChatFile(pending.file);
          attachments.push({
            id: makeId("attachment"),
            messageId,
            type: "document",
            name: codexUpload.name,
            url: codexUpload.url,
            download_url: codexUpload.download_url,
            downloadUrl: codexUpload.download_url || codexUpload.url,
            size: codexUpload.size,
            mimeType: codexUpload.mimeType,
            uploadedAt: nowIso(),
            textContent: codexUpload.textContent,
            metadata: {
              trained: false,
              codexStorage: true,
              message: "Ready for Codex extraction.",
            },
          });
        } catch (error) {
          console.warn("Codex chat file upload failed:", error);
        }

        try {
          const upload = await uploadAIDocument({
            file: pending.file,
            context: {
              userId: userId ?? "anonymous",
              organizationId: organizationId ?? "workspace-default",
              role: role ?? "employee",
              currentModule: "ai-workspace",
              currentRoute: "/ai-workspace",
              channel: "web",
              timezone: "Africa/Harare",
            },
            metadata: {
              projectId: selectedProjectId,
              projectName: selectedProject?.title ?? "General",
              source: "ai-workspace-chat",
            },
          });

          const existing = attachments.find(
            (item) => item.messageId === messageId && item.type === "document",
          );
          if (existing) {
            existing.metadata = {
              ...existing.metadata,
              documentId: upload.documentId,
              trained: upload.success,
              message: upload.message,
            };
            if (upload.sourceUrl && !existing.url.startsWith("http")) {
              existing.url = upload.sourceUrl;
              existing.download_url = upload.sourceUrl;
              existing.downloadUrl = upload.sourceUrl;
            }
          } else {
            attachments.push({
              id: makeId("attachment"),
              messageId,
              type: "document",
              name: pending.file.name,
              url: upload.sourceUrl || "",
              download_url: upload.sourceUrl || "",
              downloadUrl: upload.sourceUrl || "",
              size: pending.file.size,
              mimeType: pending.file.type || "application/octet-stream",
              uploadedAt: nowIso(),
              metadata: {
                documentId: upload.documentId,
                trained: upload.success,
                message: upload.message,
              },
            });
          }
          continue;
        } catch (error) {
          console.warn("Document training upload failed:", error);
        }

        if (attachments.some((item) => item.messageId === messageId && item.type === "document")) {
          continue;
        }
      }

      attachments.push({
        id: makeId("attachment"),
        messageId,
        type: pending.type,
        name: pending.file.name,
        url: pending.previewUrl || "",
        download_url: pending.previewUrl || "",
        downloadUrl: pending.previewUrl || "",
        size: pending.file.size,
        mimeType: pending.file.type || "application/octet-stream",
        uploadedAt: nowIso(),
        metadata: pending.type === "document"
          ? { trained: false, uploadError: "Document upload failed. Try a smaller PDF/CSV or paste a report URL." }
          : undefined,
      });
    }

    return attachments;
  };

  const handleSend = useCallback(async () => {
    if ((!input.trim() && pendingAttachments.length === 0) || busy || !userId) {
      return;
    }
    if (!organizationId) {
      setError("Your organization is still loading. Please try again in a moment.");
      return;
    }

    const prompt = input.trim();
    const outgoingFiles = pendingAttachments;
    setError(null);

    let conversationId = activeConversationId;
    if (!conversationId) {
      try {
        const conversation = await ChatHistoryService.createConversation({
          userId,
          organizationId,
          title: prompt.slice(0, 58) || outgoingFiles[0]?.file.name || "New Chat",
          role: role || undefined,
          projectId: selectedProjectId,
          projectName: selectedProject?.title ?? null,
        });
        conversationId = conversation.id;
        setActiveConversationId(conversation.id);
        setConversations((prev) => [conversation, ...prev]);
      } catch (error) {
        console.error("Error creating conversation:", error);
        setError("Failed to create a chat.");
        return;
      }
    }

    const userMessageId = makeId("msg");
    const attachments = await buildChatAttachments(outgoingFiles, userMessageId);
    const userMessage: LocalChatMessage = {
      id: userMessageId,
      conversationId,
      role: "user",
      content: prompt,
      attachments,
      createdAt: nowIso(),
      userId,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setPendingAttachments([]);
    setShowStarters(false);

    try {
      await ChatHistoryService.addMessage({
        conversationId,
        role: "user",
        content: prompt,
        userId,
        organizationId,
        type: attachments.length ? "mixed" : "text",
        data: {
          attachments: attachments.map((attachment) => ({
            type: attachment.type,
            name: attachment.name,
            url: attachment.url,
            download_url: attachment.download_url || attachment.url,
            downloadUrl: attachment.downloadUrl || attachment.download_url || attachment.url,
            size: attachment.size,
            mimeType: attachment.mimeType,
            metadata: attachment.metadata,
          })),
        },
      });
    } catch (error) {
      console.error("Error saving message:", error);
    }

    const typingMessage: LocalChatMessage = {
      id: makeId("typing"),
      conversationId,
      role: "assistant",
      content: getLoadingLabel(prompt, outgoingFiles),
      createdAt: nowIso(),
      userId,
      pending: true,
    };

    setMessages((prev) => [...prev, typingMessage]);

    try {
      const response = await onAsk(prompt, attachments, {
        projectId: selectedProjectId,
        projectName: selectedProject?.title ?? "General",
        projectMemoryScope: selectedProjectId ? "project" : "general",
      });
      const assistantMessage: LocalChatMessage = {
        id: makeId("msg"),
        conversationId,
        role: "assistant",
        content: response.content,
        attachments: response.attachments,
        createdAt: nowIso(),
        userId,
      };

      setMessages((prev) => [
        ...prev.filter((message) => message.id !== typingMessage.id),
        assistantMessage,
      ]);

      try {
        await ChatHistoryService.addMessage({
          conversationId,
          role: "assistant",
          content: response.content,
          userId,
          organizationId,
          type: "text",
          data: {
            model: "workspace-ai",
            tokens: response.content.length,
            attachments: response.attachments?.map((attachment) => ({
              type: attachment.type,
              name: attachment.name,
              url: attachment.url,
              download_url: attachment.download_url || attachment.url,
              downloadUrl: attachment.downloadUrl || attachment.download_url || attachment.url,
              size: attachment.size,
              mimeType: attachment.mimeType,
              metadata: attachment.metadata,
            })) ?? [],
          },
        });
      } catch (error) {
        console.warn("Assistant response was shown but not saved:", error);
      }

      await loadConversations();
    } catch (error) {
      console.error("Chat AI service error:", error);
      const errorMessage = error instanceof Error
        ? error.message
        : "Something went wrong while getting the response. Please try again.";
      setMessages((prev) =>
        prev.map((item) =>
          item.id === typingMessage.id
            ? { ...item, content: errorMessage, pending: false, error: true }
            : item,
        ),
      );
    }
  }, [
    activeConversationId,
    busy,
    input,
    loadConversations,
    onAsk,
    organizationId,
    pendingAttachments,
    role,
    selectedProject?.title,
    selectedProjectId,
    userId,
  ]);

  const regenerateImage = useCallback(
    async (assistantMessageId: string) => {
      if (busy || !userId || !organizationId) return;

      const assistantIndex = messages.findIndex(
        (message) => message.id === assistantMessageId,
      );
      const targetMessage = messages[assistantIndex];
      if (!targetMessage) return;

      const previousUserMessage = messages
        .slice(0, assistantIndex)
        .reverse()
        .find((message) => message.role === "user");
      const originalPrompt = previousUserMessage?.content?.trim();
      const prompt = originalPrompt
        ? `Regenerate this image with the same request: ${originalPrompt}`
        : "Regenerate the last image with a similar prompt.";
      const conversationId = targetMessage.conversationId || activeConversationId;
      if (!conversationId) return;

      const typingMessage: LocalChatMessage = {
        id: makeId("typing"),
        conversationId,
        role: "assistant",
        content: "Regenerating image...",
        createdAt: nowIso(),
        userId,
        pending: true,
      };

      setError(null);
      setMessages((prev) => [...prev, typingMessage]);

      try {
        const response = await onAsk(prompt, [], {
          projectId: selectedProjectId,
          projectName: selectedProject?.title ?? "General",
          projectMemoryScope: selectedProjectId ? "project" : "general",
          action: "regenerate_image",
        });
        const assistantMessage: LocalChatMessage = {
          id: makeId("msg"),
          conversationId,
          role: "assistant",
          content: response.content,
          attachments: response.attachments,
          createdAt: nowIso(),
          userId,
        };

        setMessages((prev) => [
          ...prev.filter((message) => message.id !== typingMessage.id),
          assistantMessage,
        ]);

        try {
          await ChatHistoryService.addMessage({
            conversationId,
            role: "assistant",
            content: response.content,
            userId,
            organizationId,
            type: "text",
            data: {
              model: "workspace-ai",
              regeneratedFrom: assistantMessageId,
              attachments: response.attachments?.map((attachment) => ({
                type: attachment.type,
                name: attachment.name,
                url: attachment.url,
                download_url: attachment.download_url || attachment.url,
                downloadUrl: attachment.downloadUrl || attachment.download_url || attachment.url,
                size: attachment.size,
                mimeType: attachment.mimeType,
                metadata: attachment.metadata,
              })) ?? [],
            },
          });
        } catch (error) {
          console.warn("Regenerated image was shown but not saved:", error);
        }
      } catch (error) {
        console.error("Image regeneration failed:", error);
        const errorMessage = error instanceof Error
          ? error.message
          : "Image regeneration failed. Please try again.";
        setMessages((prev) =>
          prev.map((item) =>
            item.id === typingMessage.id
              ? { ...item, content: errorMessage, pending: false, error: true }
              : item,
          ),
        );
      }
    },
    [
      activeConversationId,
      busy,
      messages,
      onAsk,
      organizationId,
      selectedProject?.title,
      selectedProjectId,
      userId,
    ],
  );

  const activeTitle = activeConversation?.title || "New chat";

  return (
    <div className="flex h-screen overflow-hidden bg-[#212121] text-white">
      <div className="hidden md:block">
        <ChatSidebar
          projects={projects}
          selectedProjectId={selectedProjectId}
          conversations={conversations}
          activeConversationId={activeConversationId}
          searchQuery={searchQuery}
          onSearch={setSearchQuery}
          onSelectProject={(projectId) => {
            setSelectedProjectId(projectId);
            setActiveConversationId(undefined);
            setMessages([]);
            setShowStarters(true);
          }}
          onCreateProject={() => setShowProjectModal(true)}
          onSelectConversation={loadConversation}
          onNewConversation={createNewConversation}
          onDeleteConversation={deleteConversation}
        />
      </div>

      {showMobileHistory && (
        <div className="fixed inset-0 z-40 bg-black/70 md:hidden">
          <div className="h-full w-[86vw] max-w-sm">
            <ChatSidebar
              projects={projects}
              selectedProjectId={selectedProjectId}
              conversations={conversations}
              activeConversationId={activeConversationId}
              searchQuery={searchQuery}
              onSearch={setSearchQuery}
              onSelectProject={(projectId) => {
                setSelectedProjectId(projectId);
                setActiveConversationId(undefined);
                setMessages([]);
                setShowStarters(true);
                setShowMobileHistory(false);
              }}
              onCreateProject={() => setShowProjectModal(true)}
              onSelectConversation={loadConversation}
              onNewConversation={createNewConversation}
              onDeleteConversation={deleteConversation}
            />
          </div>
          <button
            type="button"
            onClick={() => setShowMobileHistory(false)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white"
            aria-label="Close history"
          >
            <X size={18} />
          </button>
        </div>
      )}

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between px-4">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setShowMobileHistory(true)}
              className="rounded-lg p-2 text-white/60 transition hover:bg-white/10 hover:text-white md:hidden"
              aria-label="Open chat history"
            >
              <Menu size={18} />
            </button>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-medium text-white/88">
                {selectedProject?.title ?? "AI Workspace"}
              </h2>
              <p className="truncate text-xs text-white/38 md:hidden">
                {activeTitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/15"
              >
                <ArrowLeft size={15} />
                Back
              </button>
            )}
            <button
              type="button"
              onClick={createNewConversation}
              className="hidden items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/15 sm:inline-flex"
            >
              <Plus size={15} />
              New
            </button>
          </div>
        </header>

        {error && (
          <div className="mx-4 mt-4 flex items-center justify-between rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
            <button type="button" onClick={() => setError(null)}>
              <X size={14} />
            </button>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 py-6">
            {loading ? (
              <div className="flex flex-1 items-center justify-center">
                <Loader2 size={24} className="animate-spin text-orange-300" />
              </div>
            ) : showStarters && messages.length === 0 ? (
              <div className="flex flex-1 flex-col justify-center">
                <div className="mx-auto max-w-2xl text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white/80">
                    <Sparkles size={22} />
                  </div>
                  <h3 className="mt-5 text-3xl font-semibold text-white">
                    What can I help with?
                  </h3>
                  <p className="mt-2 text-sm text-white/48">
                    Ask a question, attach a file, or continue from your saved chats.
                  </p>
                </div>

                <div className="mx-auto mt-8 grid w-full max-w-2xl gap-3 sm:grid-cols-2">
                  {CHAT_STARTERS.map((starter) => (
                    <button
                      key={starter.label}
                      type="button"
                      onClick={() => {
                        setInput(starter.prompt);
                        setShowStarters(false);
                      }}
                      className="rounded-2xl border border-white/10 bg-white/4 p-4 text-left transition hover:bg-white/8"
                    >
                      <span className="text-sm font-medium text-white">
                        {starter.label}
                      </span>
                      <span className="mt-2 block text-sm leading-5 text-white/48">
                        {starter.prompt}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    onDelete={message.role === "user" ? deleteMessage : undefined}
                    onRegenerateImage={regenerateImage}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        <footer className="bg-[#212121] px-4 pb-5 pt-3">
          <div className="mx-auto max-w-3xl">
            {pendingAttachments.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {pendingAttachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex max-w-65 items-center gap-2 rounded-xl border border-white/10 bg-white/6 p-2"
                  >
                    {attachment.previewUrl ? (
                      <img
                        src={attachment.previewUrl}
                        alt={attachment.file.name}
                        className="h-9 w-9 rounded-md object-cover"
                      />
                    ) : (
                      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-white/10 text-white/55">
                        <AttachmentIcon type={attachment.type} />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-white">
                        {attachment.file.name}
                      </span>
                      <span className="text-[11px] text-white/40">
                        {formatFileSize(attachment.file.size)}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removePendingAttachment(attachment.id)}
                      className="rounded-md p-1 text-white/45 transition hover:bg-white/10 hover:text-white"
                      aria-label="Remove attachment"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-end gap-2 rounded-[28px] border border-white/12 bg-[#2f2f2f] p-2 shadow-[0_12px_40px_rgba(0,0,0,0.22)] focus-within:border-white/22">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(event) => handleFilesSelected(event.target.files)}
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,audio/*,video/*"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mb-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
                aria-label="Attach files"
              >
                <Paperclip size={18} />
              </button>

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask anything"
                rows={1}
                className="min-h-10 flex-1 resize-none bg-transparent px-1 py-2 text-[15px] leading-6 text-white outline-none placeholder:text-white/38"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
              />

              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={
                  busy || (!input.trim() && pendingAttachments.length === 0)
                }
                className="mb-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-black transition hover:bg-white/85 disabled:bg-white/10 disabled:text-white/35"
                aria-label="Send message"
              >
                {busy ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <ArrowUp size={17} />
                )}
              </button>
            </div>
          </div>
        </footer>
      </section>

      {showProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#202020] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  New project
                </h3>
                <p className="mt-1 text-sm leading-5 text-white/45">
                  Create a focused AI space with its own chats, files, and memory.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowProjectModal(false)}
                className="rounded-full p-2 text-white/45 transition hover:bg-white/10 hover:text-white"
                aria-label="Close project modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-white/78">
                  Project name
                </span>
                <input
                  value={newProjectTitle}
                  onChange={(event) => setNewProjectTitle(event.target.value)}
                  placeholder="Website redesign, SEO campaign, IT support..."
                  autoFocus
                  className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-white/6 px-4 text-sm text-white outline-none placeholder:text-white/32 focus:border-white/24"
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && newProjectTitle.trim()) {
                      event.preventDefault();
                      void createProject();
                    }
                  }}
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-white/78">
                  Memory note
                </span>
                <textarea
                  value={newProjectDescription}
                  onChange={(event) =>
                    setNewProjectDescription(event.target.value)
                  }
                  placeholder="Optional context the assistant should remember for this project."
                  rows={3}
                  className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-white/32 focus:border-white/24"
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowProjectModal(false)}
                className="rounded-xl px-4 py-2 text-sm font-medium text-white/62 transition hover:bg-white/8 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void createProject()}
                disabled={!newProjectTitle.trim() || creatingProject}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-white/85 disabled:bg-white/10 disabled:text-white/35"
              >
                {creatingProject && (
                  <Loader2 size={15} className="animate-spin" />
                )}
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
