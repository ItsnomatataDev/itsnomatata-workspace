type PlatformAuditLog = {
  id: string;
  action: string;
  reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  actor_user_id: string | null;
  target_organization_id: string | null;
  target_user_id: string | null;
};

export default function AuditLogTable({
  logs,
}: {
  logs: PlatformAuditLog[];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10">
      <table className="w-full text-left text-sm">
        <thead className="bg-[#181818] text-xs uppercase text-white/45">
          <tr>
            <th className="px-4 py-3">Action</th>
            <th className="px-4 py-3">Reason</th>
            <th className="px-4 py-3">Target Org</th>
            <th className="px-4 py-3">Date</th>
          </tr>
        </thead>

        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-t border-white/10">
              <td className="px-4 py-3">
                <p className="font-semibold text-white">{log.action}</p>
                <p className="text-xs text-white/40">{log.id}</p>
              </td>

              <td className="px-4 py-3 text-white/70">
                {log.reason ?? "-"}
              </td>

              <td className="px-4 py-3 text-white/70">
                {log.target_organization_id ?? "-"}
              </td>

              <td className="px-4 py-3 text-white/50">
                {new Date(log.created_at).toLocaleString()}
              </td>
            </tr>
          ))}

          {logs.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-white/45">
                No platform audit logs found.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}