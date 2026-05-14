import RoleBadge from "./RoleBadge";
import type { OrganizationMemberRow } from "../services/organizationMemberService";

export default function MemberTable({
  members,
}: {
  members: OrganizationMemberRow[];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10">
      <table className="w-full text-left text-sm">
        <thead className="bg-[#181818] text-xs uppercase text-white/45">
          <tr>
            <th className="px-4 py-3">Member</th>
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.id} className="border-t border-white/10">
              <td className="px-4 py-3">
                <p className="font-medium text-white">
                  {member.profiles?.full_name || member.profiles?.email || member.user_id}
                </p>
                <p className="text-xs text-white/45">{member.profiles?.email}</p>
              </td>
              <td className="px-4 py-3">
                <RoleBadge role={member.role} />
              </td>
              <td className="px-4 py-3 text-white/60">{member.status}</td>
            </tr>
          ))}
          {members.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-4 py-8 text-center text-white/45">
                No members found.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
