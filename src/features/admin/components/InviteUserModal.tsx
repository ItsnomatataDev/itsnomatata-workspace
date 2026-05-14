import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { inviteEmployeeToOrganization } from "../services/adminService";
import { getOrganizationRoles } from "../../platform-admin/services/platformAdminService";

type InviteUserModalProps = {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  invitedBy: string;
  onInvited: () => Promise<void> | void;
};

type RoleOption = {
  value: string;
  label: string;
  isDefault?: boolean;
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function getFriendlyErrorMessage(message?: string) {
  if (!message) return "Failed to add user to organization.";

  if (message.includes("No profile row was returned")) {
    return "The user exists, but the app could not read the matching profile row. This usually means the person is outside your organization visibility rules or the profile email does not match exactly.";
  }

  if (message.includes("Multiple profiles were found")) {
    return "More than one profile uses this email. Clean up duplicate profile records first.";
  }

  if (message.includes("duplicate key value")) {
    return "This user may already be assigned to the organization.";
  }

  if (message.includes("row-level security")) {
    return "The database blocked this action because of access rules. Check your RLS policies for profiles and organization members.";
  }

  return message;
}

export default function InviteUserModal({
  open,
  onClose,
  organizationId,
  invitedBy,
  onInvited,
}: InviteUserModalProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("user");
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>([
    { value: "employee", label: "Employee", isDefault: true },
  ]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const normalizedEmail = useMemo(() => normalizeEmail(email), [email]);

  useEffect(() => {
    if (!open || !organizationId) return;

    let mounted = true;
    async function loadRoles() {
      try {
        setRolesLoading(true);
        const roles = await getOrganizationRoles(organizationId);
        if (!mounted) return;

        const activeRoles = roles
          .filter((item) => item.is_active)
          .map((item) => ({
            value: item.role_key,
            label: item.role_label,
            isDefault: item.is_default_signup_role,
          }));
        const nextRoles =
          activeRoles.length > 0
            ? activeRoles
            : [{ value: "employee", label: "Employee", isDefault: true }];
        setRoleOptions(nextRoles);
        setRole((current) => {
          if (nextRoles.some((option) => option.value === current)) return current;
          return (
            nextRoles.find((option) => option.isDefault)?.value ??
            nextRoles[0].value
          );
        });
      } catch (err) {
        console.error("LOAD INVITE ROLES ERROR:", err);
        if (mounted) {
          setError(getFriendlyErrorMessage(err instanceof Error ? err.message : ""));
        }
      } finally {
        if (mounted) setRolesLoading(false);
      }
    }

    void loadRoles();

    return () => {
      mounted = false;
    };
  }, [open, organizationId]);

  if (!open) return null;

  const resetForm = () => {
    setFullName("");
    setEmail("");
    setRole(roleOptions.find((option) => option.isDefault)?.value ?? roleOptions[0]?.value ?? "employee");
    setError("");
    setSuccessMessage("");
  };

  const handleClose = () => {
    if (busy) return;
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!organizationId) {
      setError("Missing organization context.");
      return;
    }

    if (!fullName.trim()) {
      setError("Please enter the user's full name.");
      return;
    }

    if (!normalizedEmail) {
      setError("Please enter the user's email.");
      return;
    }

    try {
      setBusy(true);

      const result = await inviteEmployeeToOrganization({
        organizationId,
        email: normalizedEmail,
        fullName: fullName.trim(),
        role,
        invitedBy,
      });

      setSuccessMessage(result.message);
      await onInvited();

      window.setTimeout(() => {
        resetForm();
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error("INVITE USER ERROR:", err);
      setError(getFriendlyErrorMessage(err?.message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 py-6">
      <div className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-3xl border border-white/10 bg-zinc-950 p-4 shadow-2xl sm:p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Add Employee</h2>
            <p className="mt-1 text-sm text-white/55">
              Invite a team member into this organization
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={busy}
            className="rounded-xl border border-white/10 p-2 text-white/70 hover:bg-white/5 hover:text-white disabled:opacity-60"
          >
            <X size={18} />
          </button>
        </div>

        {error ? (
          <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        {successMessage ? (
          <div className="mb-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            {successMessage}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm text-white/70">
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              disabled={busy}
              className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500 disabled:opacity-60"
              placeholder="Thando Mpofu"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-white/70">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={busy}
              className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500 disabled:opacity-60"
              placeholder="user@example.com"
            />
            <p className="mt-2 text-xs text-white/40">
              Email is normalized to lowercase before lookup.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm text-white/70">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={busy || rolesLoading}
              className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500 disabled:opacity-60"
            >
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-white/40">
              {rolesLoading
                ? "Loading organization roles..."
                : "Roles come from this organization's role settings."}
            </p>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-2xl bg-orange-500 px-4 py-3 font-semibold text-black transition hover:bg-orange-400 disabled:opacity-60"
          >
              {busy ? "Creating invite..." : "Create Invite"}
          </button>
        </form>
      </div>
    </div>
  );
}
