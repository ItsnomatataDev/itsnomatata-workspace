import { useEffect, useState } from "react";
import { X, Search, Loader2 } from "lucide-react";
import type { ChatUser } from "../types/chat";
import { getOrganizationUsers } from "../services/chatService";

export default function NewChatModal({
  open,
  organizationId,
  currentUserId,
  onClose,
  onSelectUser,
}: {
  open: boolean;
  organizationId: string | null | undefined;
  currentUserId: string | null | undefined;
  onClose: () => void;
  onSelectUser: (user: ChatUser) => Promise<void> | void;
}) {
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    // 🔥 Debug logs (VERY IMPORTANT)
    console.log("MODAL OPEN");
    console.log("ORG ID:", organizationId);
    console.log("CURRENT USER:", currentUserId);

    if (!organizationId) {
      setError("Missing organization ID. Profile not loaded.");
      return;
    }

    if (!currentUserId) {
      setError("Missing current user.");
      return;
    }

    void (async () => {
      try {
        setLoading(true);
        setError("");

        const data = await getOrganizationUsers(organizationId, currentUserId);

        console.log("FETCHED USERS:", data);

        setUsers(data);
      } catch (err: any) {
        console.error("LOAD USERS ERROR:", err);
        setError(err?.message || "Failed to load team members.");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, organizationId, currentUserId]);

  if (!open) return null;

  const filteredUsers = users.filter((user) => {
    const text =
      `${user.full_name ?? ""} ${user.email ?? ""} ${user.primary_role ?? ""}`.toLowerCase();
    return text.includes(query.toLowerCase());
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-neutral-950 shadow-2xl">
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Start new chat</h2>
            <p className="mt-1 text-sm text-white/50">
              Select a team member to open a direct conversation
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* SEARCH */}
        <div className="border-b border-white/10 p-4">
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <Search size={16} className="text-white/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people..."
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/35"
            />
          </div>
        </div>

        {/* BODY */}
        <div className="max-h-[60vh] overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center gap-2 px-2 py-6 text-sm text-white/50">
              <Loader2 size={16} className="animate-spin" />
              Loading team members...
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="px-2 py-6 text-sm text-white/50">
              No users found.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredUsers.map((user) => {
                const isBusy = busyUserId === user.id;

                return (
                  <button
                    key={user.id}
                    type="button"
                    disabled={isBusy}
                    onClick={async () => {
                      try {
                        setBusyUserId(user.id);
                        await onSelectUser(user);
                      } catch (err) {
                        console.error("START CHAT ERROR:", err);
                      } finally {
                        setBusyUserId(null);
                      }
                    }}
                    className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/3 px-4 py-3 text-left transition hover:bg-white/6 disabled:opacity-60"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">
                        {user.full_name || user.email || "Unnamed user"}
                      </p>
                      <p className="mt-1 truncate text-xs text-white/45">
                        {user.email || "No email"}{" "}
                        {user.primary_role ? `• ${user.primary_role}` : ""}
                      </p>
                    </div>

                    {isBusy ? (
                      <Loader2
                        size={16}
                        className="animate-spin text-orange-400"
                      />
                    ) : (
                      <span className="text-xs font-medium text-orange-400">
                        Chat
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
