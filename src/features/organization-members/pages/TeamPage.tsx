import { useEffect, useMemo, useState } from "react";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import { useAuth } from "../../../app/providers/AuthProvider";
import MemberTable from "../components/MemberTable";
import {
  getOrganizationMemberRoles,
  getOrganizationMembers,
  inviteOrganizationMember,
  type OrganizationMemberRow,
} from "../services/organizationMemberService";
import type { OrganizationRole } from "../../platform-admin/types/platformAdmin";

export default function TeamPage() {
  const auth = useAuth();
  const profile = auth?.profile ?? null;
  const organizationId = profile?.organization_id ?? null;
  const [members, setMembers] = useState<OrganizationMemberRow[]>([]);
  const [roles, setRoles] = useState<OrganizationRole[]>([]);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [roleKey, setRoleKey] = useState("employee");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const activeRoles = useMemo(
    () => roles.filter((role) => role.is_active),
    [roles],
  );

  async function loadTeam() {
    if (!organizationId) return;
    try {
      setLoading(true);
      setError("");
      const [memberRows, roleRows] = await Promise.all([
        getOrganizationMembers(organizationId),
        getOrganizationMemberRoles(organizationId),
      ]);
      setMembers(memberRows);
      setRoles(roleRows);
      const defaultRole =
        roleRows.find((role) => role.is_active && role.is_default_signup_role) ??
        roleRows.find((role) => role.is_active);
      if (defaultRole) setRoleKey(defaultRole.role_key);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load team.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTeam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  async function inviteMember(event: React.FormEvent) {
    event.preventDefault();
    if (!organizationId || !email.trim()) return;

    try {
      setBusy(true);
      setError("");
      setSuccess("");
      await inviteOrganizationMember({
        organizationId,
        email: email.trim(),
        fullName: fullName.trim() || null,
        roleKey,
      });
      setEmail("");
      setFullName("");
      setSuccess("Invitation created.");
      await loadTeam();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to invite member.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <Sidebar role={profile?.primary_role} />
        <main className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
              Organization Team
            </p>
            <h1 className="mt-2 text-3xl font-bold">Team Access</h1>
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
              {success}
            </div>
          ) : null}

          <form
            onSubmit={inviteMember}
            className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 lg:grid-cols-[1fr_1fr_220px_auto]"
          >
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Full name"
              className="rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
            />
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="email@company.com"
              className="rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
              required
            />
            <select
              value={roleKey}
              onChange={(event) => setRoleKey(event.target.value)}
              className="rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
            >
              {(activeRoles.length > 0
                ? activeRoles
                : [{ id: "employee", role_key: "employee", role_label: "Employee" } as OrganizationRole]
              ).map((role) => (
                <option key={role.id} value={role.role_key}>
                  {role.role_label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black hover:bg-orange-400 disabled:opacity-50"
            >
              {busy ? "Inviting..." : "Invite"}
            </button>
          </form>

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/50">
              Loading team...
            </div>
          ) : (
            <MemberTable members={members} />
          )}
        </main>
      </div>
    </div>
  );
}
