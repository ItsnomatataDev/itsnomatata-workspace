import type { OrganizationRole } from "../types/platformAdmin";

export default function RoleManagementTable({
  roles,
  onToggleActive,
}: {
  roles: OrganizationRole[];
  onToggleActive?: (role: OrganizationRole) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10">
      <table className="w-full text-left text-sm">
        <thead className="bg-[#181818] text-xs uppercase text-white/45">
          <tr>
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3">Department</th>
            <th className="px-4 py-3">Admin</th>
            <th className="px-4 py-3">Active</th>
          </tr>
        </thead>

        <tbody>
          {roles.map((role) => (
            <tr key={role.id} className="border-t border-white/10">
              <td className="px-4 py-3">
                <p className="font-medium text-white">{role.role_label}</p>
                <p className="text-xs text-white/45">{role.role_key}</p>
              </td>

              <td className="px-4 py-3 text-white/70">
                {role.department ?? "-"}
              </td>

              <td className="px-4 py-3 text-white/70">
                {role.is_admin_role ? "Yes" : "No"}
              </td>

              <td className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => onToggleActive?.(role)}
                  className={[
                    "rounded-full px-2 py-1 text-[11px] font-semibold transition",
                    role.is_active
                      ? "bg-orange-500 text-black"
                      : "bg-white/10 text-white/45 hover:bg-white/15",
                  ].join(" ")}
                >
                  {role.is_active ? "Active" : "Inactive"}
                </button>
              </td>
            </tr>
          ))}

          {roles.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-white/45">
                No organization roles found.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
