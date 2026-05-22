import { useCallback, useEffect, useRef, useState } from "react";
import {
  getLivekitToken,
  type LivekitTokenResponse,
} from "../services/livekitTokenService";

export function useLivekitToken(params: {
  meetingId?: string | null;
  enabled?: boolean;
}) {
  const enabled = params.enabled ?? true;
  const meetingId = params.meetingId?.trim() || "";
  const [session, setSession] = useState<LivekitTokenResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestIdRef = useRef(0);

  const reload = useCallback(async () => {
    if (!meetingId || !enabled) {
      setSession(null);
      setError("");
      setLoading(false);
      return null;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    try {
      setLoading(true);
      setError("");

      const nextSession = await getLivekitToken({ meetingId });

      if (requestIdRef.current === requestId) {
        setSession(nextSession);
      }

      return nextSession;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create LiveKit session.";

      if (requestIdRef.current === requestId) {
        setSession(null);
        setError(message);
      }

      return null;
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [enabled, meetingId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const clearSession = useCallback(() => {
    requestIdRef.current += 1;
    setSession(null);
    setError("");
    setLoading(false);
  }, []);

  return {
    session,
    loading,
    error,
    reload,
    clearSession,
  };
}
