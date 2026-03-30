import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  getITProjectsForDashboard,
  inviteProjectMember,
  type MemberRole,
  type ITProjectDashboardItem,
} from "../services/itWorkspaceService";

type InviteMemberModalProps = {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  userId: string;
  onInvited: () => Promise<void> | void;
};

export default function InviteMemberModal({
  open,
  onClose,
  organizationId,
  userId,
  onInvited,
}: InviteMemberModalProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("member");
  const [projectId, setProjectId] = useState("");
  const [projects, setProjects] = useState<ITProjectDashboardItem[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    const loadProjects = async () => {
      try {
        setLoadingProjects(true);
        const data = await getITProjectsForDashboard(organizationId, userId);
        setProjects(data);
      } catch (err: any) {
        console.error("LOAD PROJECTS FOR INVITE ERROR:", err);
        setError(err?.message || "Failed to load projects.");
      } finally {
        setLoadingProjects(false);
      }
    };

    void loadProjects();
  }, [open, organizationId, userId]);

  if (!open) return null;

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      setBusy(true);

      await inviteProjectMember({
        organizationId,
        projectId,
        invitedBy: userId,
        email,
        role,
      });

      setEmail("");
      setRole("member");
      setProjectId("");
      await onInvited();
      onClose();
    } catch (err: any) {
      console.error("INVITE MEMBER ERROR:", err);
      setError(err?.message || "Failed to invite member.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Invite Member</h2>
            <p className="mt-1 text-sm text-white/55">
              Invite someone into a real project
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 p-2 text-white/70 hover:bg-white/5 hover:text-white"
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        {error ? (
          <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleInvite} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm text-white/70">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@example.com"
              className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-white/70">Project</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              required
              disabled={loadingProjects}
              className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500 disabled:opacity-60"
            >
              <option value="">Select project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-white/70">
              Project Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as MemberRole)}
              className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
            >
              <option value="owner">Owner</option>
              <option value="manager">Manager</option>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={busy || loadingProjects}
            className="w-full rounded-2xl bg-orange-500 px-4 py-3 font-semibold text-black transition hover:bg-orange-400 disabled:opacity-60"
          >
            {busy ? "Sending invite..." : "Send Invite"}
          </button>
        </form>
      </div>
    </div>
  );
}
