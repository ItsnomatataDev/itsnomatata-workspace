import {
  Ban,
  Clock3,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
  ShieldCheck,
  X,
} from "lucide-react";
import UserAvatar from "../../../components/common/UserAvatar";
import type { ChatConversation, ChatMessage } from "../types/chat";

const DISAPPEARING_OPTIONS = [
  { label: "Off", value: null },
  { label: "1 hour", value: 3600 },
  { label: "24 hours", value: 86400 },
  { label: "7 days", value: 604800 },
  { label: "30 days", value: 2592000 },
];

function extractLinks(messages: ChatMessage[]) {
  const urlPattern = /https?:\/\/[^\s<>"')]+/gi;
  return messages.flatMap((message) => message.body?.match(urlPattern) ?? []);
}

function isSharedImage(message: ChatMessage) {
  const metadataType = message.metadata?.message_type ?? message.metadata?.type;
  return (
    message.message_type === "image" ||
    metadataType === "gif" ||
    metadataType === "meme"
  );
}

function getMediaUrl(message: ChatMessage) {
  if (message.attachment_url) return message.attachment_url;
  if (typeof message.metadata?.media_url === "string") return message.metadata.media_url;
  if (message.metadata?.gif?.url) return message.metadata.gif.url;
  return null;
}

export default function ChatInfoPanel({
  open,
  conversation,
  currentUserId,
  messages,
  blocked,
  savingSetting,
  blocking,
  onClose,
  onPreviewProfile,
  onDisappearingChange,
  onToggleBlock,
}: {
  open: boolean;
  conversation: ChatConversation | null;
  currentUserId?: string;
  messages: ChatMessage[];
  blocked: boolean;
  savingSetting: boolean;
  blocking: boolean;
  onClose: () => void;
  onPreviewProfile: (profile: { full_name?: string | null; email?: string | null; avatar_url?: string | null }) => void;
  onDisappearingChange: (seconds: number | null) => void;
  onToggleBlock: () => void;
}) {
  if (!open || !conversation) return null;

  const otherMember = conversation.type === "direct"
    ? conversation.members?.find((member) => member.user_id !== currentUserId)
    : null;
  const members = conversation.members ?? [];
  const sharedMedia = messages.filter((message) => !message.is_deleted && isSharedImage(message));
  const sharedFiles = messages.filter(
    (message) => !message.is_deleted && message.message_type === "file" && message.attachment_url,
  );
  const links = Array.from(new Set(extractLinks(messages)));

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/55 backdrop-blur-sm" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close chat information"
        onClick={onClose}
      />

      <aside className="relative flex h-full w-full max-w-md flex-col border-l border-white/10 bg-neutral-950 text-white shadow-2xl shadow-black/60">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-300">Chat Info</p>
            <h2 className="mt-1 text-base font-semibold">{conversation.display_name || "Conversation"}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white/70 transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <section className="text-center">
            <button
              type="button"
              onClick={() => {
                const profile = otherMember?.profile;
                if (profile) onPreviewProfile(profile);
              }}
              className="mx-auto block"
              aria-label="View profile picture"
            >
              <UserAvatar
                person={otherMember?.profile ?? { full_name: conversation.display_name }}
                size="xl"
                className="h-20 w-20"
              />
            </button>
            <p className="mt-3 text-lg font-semibold">{conversation.display_name}</p>
            <p className="mt-1 text-sm text-white/45">
              {conversation.type === "direct" ? otherMember?.profile?.email || "Direct chat" : `${members.length} members`}
            </p>
          </section>

          <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Clock3 size={16} className="text-orange-300" />
              Disappearing messages
            </div>
            <select
              value={conversation.disappearing_seconds ?? ""}
              disabled={savingSetting}
              onChange={(event) =>
                onDisappearingChange(event.target.value ? Number(event.target.value) : null)
              }
              className="w-full rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white outline-none focus:border-orange-400"
            >
              {DISAPPEARING_OPTIONS.map((option) => (
                <option key={option.label} value={option.value ?? ""}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs leading-5 text-white/45">
              New messages expire after the selected time. Existing messages are not changed.
            </p>
          </section>

          {conversation.type === "direct" && otherMember ? (
            <section className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck size={18} className="mt-0.5 text-red-200" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-red-100">Safety</p>
                  <p className="mt-1 text-xs leading-5 text-red-100/70">
                    Blocking stops this person from messaging you in direct chats.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={blocking}
                  onClick={onToggleBlock}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-300/20 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-500/20 disabled:opacity-50"
                >
                  <Ban size={14} />
                  {blocked ? "Unblock" : "Block"}
                </button>
              </div>
            </section>
          ) : null}

          <section className="mt-6">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <ImageIcon size={16} className="text-orange-300" />
              Shared media
            </div>
            {sharedMedia.length ? (
              <div className="grid grid-cols-3 gap-2">
                {sharedMedia.slice(-9).map((message) => {
                  const url = getMediaUrl(message);
                  if (!url) return null;
                  return (
                    <a key={message.id} href={url} target="_blank" rel="noreferrer" className="aspect-square overflow-hidden rounded-xl bg-white/10">
                      <img src={url} alt={message.attachment_name || "Shared media"} className="h-full w-full object-cover" loading="lazy" />
                    </a>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-sm text-white/40">No shared media yet.</p>
            )}
          </section>

          <section className="mt-6">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <LinkIcon size={16} className="text-orange-300" />
              Links
            </div>
            <div className="space-y-2">
              {links.length ? links.slice(-8).map((link) => (
                <a key={link} href={link} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/75 hover:border-orange-500/40">
                  <ExternalLink size={14} className="shrink-0 text-orange-300" />
                  <span className="truncate">{link}</span>
                </a>
              )) : (
                <p className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-sm text-white/40">No shared links yet.</p>
              )}
            </div>
          </section>

          <section className="mt-6">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <FileText size={16} className="text-orange-300" />
              Files
            </div>
            <div className="space-y-2">
              {sharedFiles.length ? sharedFiles.slice(-8).map((message) => (
                <a key={message.id} href={message.attachment_url ?? ""} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/75 hover:border-orange-500/40">
                  <FileText size={14} className="shrink-0 text-orange-300" />
                  <span className="truncate">{message.attachment_name || "Attachment"}</span>
                </a>
              )) : (
                <p className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-sm text-white/40">No shared files yet.</p>
              )}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}
