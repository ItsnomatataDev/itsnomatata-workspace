import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Trash2, Users } from "lucide-react";
import {
  getProjectMembers,
  removeProjectMember,
  updateProjectMemberRole,
  type MemberRole,
  type ProjectMemberItem,
} from "../services/itWorkspaceService";

type ProjectMembersPanelProps = {
  projectId: string;
  canManage?: boolean;
  refreshKey?: number;
};

const roleOptions: MemberRole[] = ["owner", "manager", "member", "viewer"];

function formatJoinedDate(value?: string | null) {
  if (!value) return "Unknown join date";
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
}

export default function ProjectMembersPanel({
  projectId,
  canManage = false,
  refreshKey = 0,
}: ProjectMembersPanelProps) {
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [items, setItems] = useState<ProjectMemberItem[]>([]);

  const loadMembers = useCallback(async () => {
    if (!projectId) return;

    try {
      setLoading(true);
      setError("");

      const data = await getProjectMembers(projectId);
      setItems(data);
    } catch (err: any) {
      console.error("PROJECT MEMBERS LOAD ERROR:", err);
      setError(err?.message || "Failed to load project members.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers, refreshKey]);

  const handleRoleChange = async (userId: string, role: MemberRole) => {
    try {
      setSavingUserId(userId);
      setError("");

      await updateProjectMemberRole(projectId, userId, role);

      setItems((prev) =>
        prev.map((item) =>
          item.user_id === userId ? { ...item, role } : item,
        ),
      );
    } catch (err: any) {
      console.error("PROJECT MEMBER ROLE UPDATE ERROR:", err);
      setError(err?.message || "Failed to update member role.");
    } finally {
      setSavingUserId(null);
    }
  };

  const handleRemove = async (userId: string) => {
    try {
      setRemovingUserId(userId);
      setError("");

      await removeProjectMember(projectId, userId);

      setItems((prev) => prev.filter((item) => item.user_id !== userId));
    } catch (err: any) {
      console.error("PROJECT MEMBER REMOVE ERROR:", err);
      setError(err?.message || "Failed to remove project member.");
    } finally {
      setRemovingUserId(null);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-orange-500/15 p-2 text-orange-500">
            <Users size={18} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">
              Project Members
            </h3>
            <p className="text-sm text-white/50">
              Collaborators currently assigned to this project
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadMembers()}
          className="rounded-xl border border-white/10 p-2 text-white/70 transition hover:bg-white/5 hover:text-white"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-4 text-sm text-white/60">Loading members...</div>
      ) : items.length === 0 ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-white/60">
          No members are attached to this project yet.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-4 rounded-xl border border-white/10 bg-black/30 px-4 py-4 lg:flex-row lg:items-center lg:justify-between"
            >
              <div>
                <p className="font-medium text-white">
                  {item.full_name || item.email || "Unknown member"}
                </p>
                <p className="mt-1 text-sm text-white/55">
                  {item.email || "No email available"}
                </p>
                <p className="mt-1 text-xs uppercase tracking-wide text-white/40">
                  Org role: {item.primary_role || "not set"} • Joined:{" "}
                  {formatJoinedDate(item.joined_at)}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {canManage ? (
                  <select
                    value={item.role}
                    disabled={savingUserId === item.user_id}
                    onChange={(e) =>
                      void handleRoleChange(
                        item.user_id,
                        e.target.value as MemberRole,
                      )
                    }
                    className="rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none focus:border-orange-500 disabled:opacity-60"
                  >
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/75">
                    {item.role}
                  </span>
                )}

                {canManage ? (
                  <button
                    type="button"
                    disabled={removingUserId === item.user_id}
                    onClick={() => void handleRemove(item.user_id)}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/15 disabled:opacity-60"
                  >
                    <Trash2 size={15} />
                    Remove
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
