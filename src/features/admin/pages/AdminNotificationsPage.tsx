import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import { useAuth } from "../../../app/providers/AuthProvider";
import {
  getNotificationDeliveryLogs,
  type NotificationDeliveryLogRow,
} from "../../../lib/supabase/queries/notifications";

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export default function AdminNotificationsPage() {
  const auth = useAuth();
  const profile = auth?.profile;
  const organizationId = profile?.organization_id ?? null;
  const role = profile?.primary_role ?? "admin";
  const [logs, setLogs] = useState<NotificationDeliveryLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadLogs() {
    if (!organizationId) {
      setError("Missing organization_id on your profile.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setLogs(await getNotificationDeliveryLogs({ organizationId, limit: 100 }));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load notification delivery logs.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLogs();
  }, [organizationId]);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen">
        <Sidebar role={role} />

        <main className="min-w-0 flex-1 p-6 lg:p-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border border-white/10 bg-black p-5">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
                Admin
              </p>
              <h1 className="mt-2 text-3xl font-bold">
                Notification Delivery Logs
              </h1>
              <p className="mt-2 text-sm text-white/50">
                Email and push delivery attempts joined to their notification and user.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadLogs()}
              disabled={loading}
              className="inline-flex items-center gap-2 border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/10 disabled:opacity-60"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>

          {error ? (
            <div className="mb-4 border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          ) : null}

          <div className="overflow-x-auto border border-white/10">
            <table className="min-w-full divide-y divide-white/10 text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-white/45">
                <tr>
                  <th className="px-4 py-3">Notification</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Channel</th>
                  <th className="px-4 py-3">Destination</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Error</th>
                  <th className="px-4 py-3">Attempted</th>
                  <th className="px-4 py-3">Delivered</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {logs.map((log) => (
                  <tr key={log.id} className="bg-black/40">
                    <td className="max-w-xs px-4 py-3 text-white">
                      {log.notification_title}
                    </td>
                    <td className="px-4 py-3 text-white/60">
                      {log.user_full_name || log.user_email || log.notification_user_id}
                    </td>
                    <td className="px-4 py-3 text-white/70">{log.channel}</td>
                    <td className="max-w-xs truncate px-4 py-3 text-white/45">
                      {log.destination || "-"}
                    </td>
                    <td className="px-4 py-3 text-white/70">{log.status}</td>
                    <td className="px-4 py-3 text-white/45">
                      {log.provider || "-"}
                    </td>
                    <td className="max-w-sm px-4 py-3 text-red-300/80">
                      {log.error_message || "-"}
                    </td>
                    <td className="px-4 py-3 text-white/45">
                      {formatDate(log.attempted_at)}
                    </td>
                    <td className="px-4 py-3 text-white/45">
                      {formatDate(log.delivered_at)}
                    </td>
                    <td className="px-4 py-3 text-white/45">
                      {formatDate(log.created_at)}
                    </td>
                  </tr>
                ))}

                {!loading && logs.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-white/45" colSpan={10}>
                      No delivery logs yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}
