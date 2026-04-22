import { CircleDot, Play, Clock3 } from "lucide-react";
import { useCardTimeTracking } from "../../../lib/hooks/useCardTimeTracking";
import { useAuth } from "../../../app/providers/AuthProvider";

interface CardTimeIndicatorProps {
  taskId?: string;
  clientId?: string;
  className?: string;
  showTotalTime?: boolean;
}

export default function CardTimeIndicator({
  taskId,
  clientId,
  className = "",
  showTotalTime = true,
}: CardTimeIndicatorProps) {
  const auth = useAuth();
  const { isTracking, liveSeconds, totalTrackedSeconds, loading } = useCardTimeTracking({
    organizationId: auth?.profile?.organization_id ?? "",
    userId: auth?.user?.id,
    taskId,
    clientId,
  });

  if (loading) {
    return (
      <div className={`flex items-center gap-1.5 text-xs text-white/40 ${className}`}>
        <Clock3 size={12} className="animate-pulse" />
        <span>Loading...</span>
      </div>
    );
  }

  const formatTime = (seconds: number) => {
    const total = Math.max(0, Math.floor(seconds));
    const hrs = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  if (isTracking) {
    return (
      <div className={`flex items-center gap-1.5 text-xs text-green-400 ${className}`}>
        <CircleDot size={10} className="animate-pulse fill-green-400" />
        <span className="font-medium">Live</span>
        {showTotalTime && (
          <span className="text-white/60">
            {formatTime(liveSeconds)}
          </span>
        )}
      </div>
    );
  }

  if (showTotalTime && totalTrackedSeconds > 0) {
    return (
      <div className={`flex items-center gap-1.5 text-xs text-white/50 ${className}`}>
        <Clock3 size={10} />
        <span>{formatTime(totalTrackedSeconds)}</span>
      </div>
    );
  }

  return null;
}
