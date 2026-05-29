import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { supabase } from "../../../lib/supabase/client";
import { buildTaskNotificationUrl } from "../../notifications/utils/notificationLinks";

/**
 * Resolves legacy `/tasks/:taskId` notification links to the board card view.
 */
export default function TaskDeepLinkPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const [targetUrl, setTargetUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!taskId) {
      setFailed(true);
      return;
    }

    let cancelled = false;

    void (async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, client_id")
        .eq("id", taskId)
        .maybeSingle();

      if (cancelled) return;

      if (error || !data) {
        setFailed(true);
        return;
      }

      setTargetUrl(
        buildTaskNotificationUrl(data.id, (data.client_id as string | null) ?? null),
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [taskId]);

  if (targetUrl) {
    return <Navigate to={targetUrl} replace />;
  }

  if (failed) {
    return <Navigate to="/tasks" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black p-6 text-white">
      <p className="text-sm text-white/60">Opening task...</p>
    </div>
  );
}
