import { useMemo, useState } from "react";
import { Edit3, Plus, Save, ShieldCheck, ToggleLeft, Users, X } from "lucide-react";
import type { OrganizationRole } from "../types/platformAdmin";

type RoleDraft = {
  role_key: string;
  role_label: string;
  description: string;
  department: string;
  is_admin_role: boolean;
  is_manager_role: boolean;
  is_default_signup_role: boolean;
  requires_approval: boolean;
  is_active: boolean;
  permissionsText: string;
  onboardingConfigText: string;
  departmentAccessText: string;
};

function emptyDraft(): RoleDraft {
  return {
    role_key: "",
    role_label: "",
    description: "",
    department: "",
    is_admin_role: false,
    is_manager_role: false,
    is_default_signup_role: false,
    requires_approval: true,
    is_active: true,
    permissionsText: "{}",
    onboardingConfigText: "{}",
    departmentAccessText: "{}",
  };
}

function draftFromRole(role: OrganizationRole): RoleDraft {
  return {
    role_key: role.role_key,
    role_label: role.role_label,
    description: role.description ?? "",
    department: role.department ?? "",
    is_admin_role: role.is_admin_role,
    is_manager_role: role.is_manager_role,
    is_default_signup_role: role.is_default_signup_role,
    requires_approval: role.requires_approval,
    is_active: role.is_active,
    permissionsText: JSON.stringify(role.permissions ?? {}, null, 2),
    onboardingConfigText: JSON.stringify(role.onboarding_config ?? {}, null, 2),
    departmentAccessText: JSON.stringify(role.department_access ?? {}, null, 2),
  };
}

function parseJsonObject(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) return {};

  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object.`);
  }

  return parsed as Record<string, unknown>;
}

function rolePayload(draft: RoleDraft) {
  return {
    roleKey: draft.role_key,
    roleLabel: draft.role_label,
    description: draft.description || null,
    department: draft.department || null,
    isAdminRole: draft.is_admin_role,
    isManagerRole: draft.is_manager_role,
    isDefaultSignupRole: draft.is_default_signup_role,
    requiresApproval: draft.requires_approval,
    isActive: draft.is_active,
    permissions: parseJsonObject(draft.permissionsText, "Permissions"),
    onboardingConfig: parseJsonObject(
      draft.onboardingConfigText,
      "Onboarding config",
    ),
    departmentAccess: parseJsonObject(
      draft.departmentAccessText,
      "Department access",
    ),
  };
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

function RoleModal({
  mode,
  draft,
  saving,
  error,
  onChange,
  onClose,
  onSubmit,
}: {
  mode: "create" | "edit";
  draft: RoleDraft;
  saving?: boolean;
  error?: string;
  onChange: (draft: RoleDraft) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const update = <K extends keyof RoleDraft>(key: K, value: RoleDraft[K]) =>
    onChange({ ...draft, [key]: value });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/10 bg-[#111111] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-orange-500">
              Role Management
            </p>
            <h3 className="mt-1 text-xl font-semibold text-white">
              {mode === "create" ? "Create Role" : "Edit Role"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-white/55 hover:bg-white/10 hover:text-white"
            aria-label="Close role editor"
          >
            <X size={18} />
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase text-white/45">
              Role Key
            </span>
            <input
              value={draft.role_key}
              disabled={mode === "edit"}
              onChange={(event) => update("role_key", event.target.value)}
              placeholder="chef"
              className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500 disabled:opacity-50"
            />
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase text-white/45">
              Role Label
            </span>
            <input
              value={draft.role_label}
              onChange={(event) => update("role_label", event.target.value)}
              placeholder="Chef"
              className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
            />
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase text-white/45">
              Department
            </span>
            <input
              value={draft.department}
              onChange={(event) => update("department", event.target.value)}
              placeholder="kitchen"
              className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
            />
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-xs font-semibold uppercase text-white/45">
              Description
            </span>
            <textarea
              value={draft.description}
              rows={3}
              onChange={(event) => update("description", event.target.value)}
              className="w-full resize-none rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
            />
          </label>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["is_admin_role", "Admin"],
            ["is_manager_role", "Manager"],
            ["is_default_signup_role", "Default Signup"],
            ["requires_approval", "Requires Approval"],
            ["is_active", "Active"],
          ].map(([key, label]) => (
            <label
              key={key}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black px-3 py-3 text-sm text-white/70"
            >
              <span>{label}</span>
              <input
                type="checkbox"
                checked={Boolean(draft[key as keyof RoleDraft])}
                onChange={(event) =>
                  update(key as keyof RoleDraft, event.target.checked as never)
                }
                className="h-4 w-4 accent-orange-500"
              />
            </label>
          ))}
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {[
            ["permissionsText", "Permissions JSON"],
            ["onboardingConfigText", "Onboarding Config JSON"],
            ["departmentAccessText", "Department Access JSON"],
          ].map(([key, label]) => (
            <label key={key} className="space-y-2">
              <span className="text-xs font-semibold uppercase text-white/45">
                {label}
              </span>
              <textarea
                value={String(draft[key as keyof RoleDraft])}
                rows={7}
                onChange={(event) =>
                  update(key as keyof RoleDraft, event.target.value as never)
                }
                className="w-full resize-none rounded-xl border border-white/10 bg-black px-4 py-3 font-mono text-xs text-white outline-none focus:border-orange-500"
              />
            </label>
          ))}
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-white/70 hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onSubmit}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black hover:bg-orange-400 disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? "Saving..." : "Save Role"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RoleManagementTable({
  roles,
  canCreate = false,
  canEdit = false,
  saving,
  onCreate,
  onUpdate,
  onToggleActive,
}: {
  roles: OrganizationRole[];
  canCreate?: boolean;
  canEdit?: boolean;
  saving?: boolean;
  onCreate?: (payload: ReturnType<typeof rolePayload>) => Promise<void> | void;
  onUpdate?: (
    role: OrganizationRole,
    payload: Omit<ReturnType<typeof rolePayload>, "roleKey">,
  ) => Promise<void> | void;
  onToggleActive?: (role: OrganizationRole) => void;
}) {
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editingRole, setEditingRole] = useState<OrganizationRole | null>(null);
  const [draft, setDraft] = useState<RoleDraft>(emptyDraft());
  const [formError, setFormError] = useState("");

  const departments = useMemo(
    () =>
      Array.from(new Set(roles.map((role) => role.department).filter(Boolean))),
    [roles],
  );

  function openCreate() {
    setDraft(emptyDraft());
    setEditingRole(null);
    setFormError("");
    setModalMode("create");
  }

  function openEdit(role: OrganizationRole) {
    setDraft(draftFromRole(role));
    setEditingRole(role);
    setFormError("");
    setModalMode("edit");
  }

  async function submitRole() {
    try {
      setFormError("");
      if (!draft.role_label.trim()) throw new Error("Role label is required.");
      const payload = rolePayload(draft);

      if (modalMode === "create") {
        if (!payload.roleKey.trim()) throw new Error("Role key is required.");
        await onCreate?.(payload);
      } else if (editingRole) {
        const { roleKey: _roleKey, ...updates } = payload;
        await onUpdate?.(editingRole, updates);
      }

      setModalMode(null);
      setEditingRole(null);
      setDraft(emptyDraft());
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to save role.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {departments.slice(0, 6).map((department) => (
            <span
              key={department}
              className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/60"
            >
              {department}
            </span>
          ))}
        </div>

        {canCreate ? (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-black hover:bg-orange-400"
          >
            <Plus size={16} />
            Create Role
          </button>
        ) : null}
      </div>

      <div className="grid gap-3">
        {roles.map((role) => {
          const permissionKeys = Object.keys(role.permissions ?? {});

          return (
            <div
              key={role.id}
              className="rounded-2xl border border-white/10 bg-black p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-semibold text-white">{role.role_label}</h4>
                    {role.is_default_signup_role ? (
                      <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[11px] font-bold text-black">
                        Default
                      </span>
                    ) : null}
                    {role.is_admin_role ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-200">
                        <ShieldCheck size={12} />
                        Admin
                      </span>
                    ) : null}
                    {role.is_manager_role ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-[11px] font-semibold text-sky-200">
                        <Users size={12} />
                        Manager
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-white/45">
                    {role.role_key} / {role.department || "No department"}
                  </p>
                  {role.description ? (
                    <p className="mt-2 text-sm text-white/65">{role.description}</p>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => openEdit(role)}
                      className="rounded-xl border border-white/10 p-2 text-white/60 hover:bg-white/10 hover:text-white"
                      aria-label={`Edit ${role.role_label}`}
                    >
                      <Edit3 size={16} />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => onToggleActive?.(role)}
                    className={[
                      "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold transition disabled:opacity-50",
                      role.is_active
                        ? "bg-emerald-500/10 text-emerald-300"
                        : "bg-white/10 text-white/45 hover:bg-white/15",
                    ].join(" ")}
                  >
                    <ToggleLeft size={14} />
                    {role.is_active ? "Active" : "Inactive"}
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] text-white/55">
                  {role.requires_approval ? "Approval required" : "Auto-approved"}
                </span>
                <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] text-white/55">
                  Created {formatDate(role.created_at)}
                </span>
                <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] text-white/55">
                  Updated {formatDate(role.updated_at)}
                </span>
                {permissionKeys.slice(0, 8).map((key) => (
                  <span
                    key={key}
                    className="rounded-full bg-orange-500/10 px-2 py-1 text-[11px] text-orange-200"
                  >
                    {key}
                  </span>
                ))}
              </div>
            </div>
          );
        })}

        {roles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-black p-8 text-center text-sm text-white/45">
            No organization roles found.
          </div>
        ) : null}
      </div>

      {modalMode ? (
        <RoleModal
          mode={modalMode}
          draft={draft}
          saving={saving}
          error={formError}
          onChange={setDraft}
          onClose={() => setModalMode(null)}
          onSubmit={() => void submitRole()}
        />
      ) : null}
    </div>
  );
}
