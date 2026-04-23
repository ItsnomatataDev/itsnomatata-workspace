import { useEffect, useMemo, useState } from "react";
import { X, Search, Loader2, Users, UserPlus, Check } from "lucide-react";
import type { ChatUser } from "../types/chat";
import { getOrganizationUsers } from "../services/chatService";

export default function NewChatModal({
  open,
  organizationId,
  currentUserId,
  onClose,
  onSelectUser,
  onCreateGroup,
}: {
  open: boolean;
  organizationId: string | null | undefined;
  currentUserId: string | null | undefined;
  onClose: () => void;
  onSelectUser: (user: ChatUser) => Promise<void> | void;
  onCreateGroup: (params: {
    title: string;
    users: ChatUser[];
  }) => Promise<void> | void;
}) {
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"direct" | "group">("direct");
  const [selectedUsers, setSelectedUsers] = useState<ChatUser[]>([]);
  const [groupTitle, setGroupTitle] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);

  useEffect(() => {
    if (!open) return;

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
        console.log("Loaded users:", data);
        setUsers(data);
      } catch (err: any) {
        console.error("LOAD USERS ERROR:", err);
        setError(err?.message || "Failed to load team members.");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, organizationId, currentUserId]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setError("");
      setMode("direct");
      setSelectedUsers([]);
      setGroupTitle("");
      setBusyUserId(null);
      setCreatingGroup(false);
    }
  }, [open]);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const text =
        `${user.full_name ?? ""} ${user.email ?? ""} ${user.primary_role ?? ""}`.toLowerCase();
      return text.includes(query.toLowerCase());
    });
  }, [users, query]);

  function isSelected(userId: string) {
    return selectedUsers.some((user) => user.id === userId);
  }

  function toggleUser(user: ChatUser) {
    setSelectedUsers((current) => {
      const exists = current.some((item) => item.id === user.id);
      if (exists) {
        return current.filter((item) => item.id !== user.id);
      }
      return [...current, user];
    });
  }

  async function handleCreateGroupClick() {
    const cleanTitle = groupTitle.trim();

    if (!cleanTitle) {
      setError("Please enter a group name.");
      return;
    }

    if (selectedUsers.length < 2) {
      setError("Select at least 2 members for a group chat.");
      return;
    }

    try {
      setCreatingGroup(true);
      setError("");
      await onCreateGroup({
        title: cleanTitle,
        users: selectedUsers,
      });
    } catch (err: any) {
      console.error("CREATE GROUP CLICK ERROR:", err);
      setError(err?.message || "Failed to create group.");
    } finally {
      setCreatingGroup(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-2xl border border-white/10 bg-neutral-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {mode === "direct" ? "Start new chat" : "Create group chat"}
            </h2>
            <p className="mt-1 text-sm text-white/50">
              {mode === "direct"
                ? "Select a team member to open a direct conversation"
                : "Choose members and give your group a name"}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white"
            aria-label="Close new chat modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="border-b border-white/10 px-4 py-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("direct")}
              className={[
                "inline-flex items-center gap-2 px-4 py-2 text-sm font-medium transition",
                mode === "direct"
                  ? "bg-orange-500 text-black"
                  : "border border-white/10 bg-white/5 text-white hover:bg-white/10",
              ].join(" ")}
            >
              <UserPlus size={16} />
              Direct chat
            </button>

            <button
              type="button"
              onClick={() => setMode("group")}
              className={[
                "inline-flex items-center gap-2 px-4 py-2 text-sm font-medium transition",
                mode === "group"
                  ? "bg-orange-500 text-black"
                  : "border border-white/10 bg-white/5 text-white hover:bg-white/10",
              ].join(" ")}
            >
              <Users size={16} />
              Group chat
            </button>
          </div>

          {mode === "group" ? (
            <div className="mt-4">
              <input
                value={groupTitle}
                onChange={(event) => setGroupTitle(event.target.value)}
                placeholder="Enter group name..."
                className="w-full border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-orange-500"
              />
            </div>
          ) : null}
        </div>

        <div className="border-b border-white/10 p-4">
          <div className="flex items-center gap-3 border border-white/10 bg-white/5 px-4 py-3">
            <Search size={16} className="text-white/40" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={
                mode === "direct" ? "Search people..." : "Search members..."
              }
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/35"
            />
          </div>
        </div>

        {mode === "group" && selectedUsers.length > 0 ? (
          <div className="border-b border-white/10 px-4 py-3">
            <p className="mb-2 text-xs uppercase tracking-wide text-white/35">
              Selected members ({selectedUsers.length})
            </p>

            <div className="flex flex-wrap gap-2">
              {selectedUsers.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => toggleUser(user)}
                  className="inline-flex items-center gap-2 bg-orange-500 px-3 py-1.5 text-xs font-medium text-black"
                >
                  <span>{user.full_name || user.email || "Unnamed user"}</span>
                  <X size={12} />
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="max-h-[50vh] overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center gap-2 px-2 py-6 text-sm text-white/50">
              <Loader2 size={16} className="animate-spin" />
              Loading team members...
            </div>
          ) : error ? (
            <div className="border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
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
                const selected = isSelected(user.id);

                return (
                  <button
                    key={user.id}
                    type="button"
                    disabled={isBusy || creatingGroup}
                    onClick={async () => {
                      if (mode === "group") {
                        toggleUser(user);
                        return;
                      }

                      try {
                        setBusyUserId(user.id);
                        await onSelectUser(user);
                      } finally {
                        setBusyUserId(null);
                      }
                    }}
                    className={[
                      "flex w-full items-center justify-between border px-4 py-3 text-left transition disabled:opacity-60",
                      selected
                        ? "border-orange-500 bg-orange-500/10"
                        : "border-white/10 bg-white/3 hover:bg-white/6",
                    ].join(" ")}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">
                        {user.full_name || user.email || user.id || "Unnamed user"}
                      </p>
                      <p className="mt-1 truncate text-xs text-white/45">
                        {user.email || "No email"}
                        {user.primary_role ? ` • ${user.primary_role}` : ""}
                      </p>
                    </div>

                    {mode === "group" ? (
                      selected ? (
                        <span className="inline-flex h-8 w-8 items-center justify-center bg-orange-500 text-black">
                          <Check size={16} />
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-orange-400">
                          Select
                        </span>
                      )
                    ) : isBusy ? (
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

        {mode === "group" ? (
          <div className="flex items-center justify-between border-t border-white/10 px-4 py-4">
            <p className="text-xs text-white/45">
              Choose at least 2 people for a group chat.
            </p>

            <button
              type="button"
              onClick={() => void handleCreateGroupClick()}
              disabled={creatingGroup}
              className="inline-flex items-center gap-2 bg-orange-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:opacity-60"
            >
              {creatingGroup ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Users size={16} />
                  Create group
                </>
              )}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
