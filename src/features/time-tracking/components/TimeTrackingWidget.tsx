import { useState, useEffect } from "react";
import { Clock, LogOut, LogIn, MapPin, Calendar, Timer, Play, Pause, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "../../../app/providers/AuthProvider";
import { TimeTrackingService } from "../services/timeTrackingService";
import type { TimeSession } from "../types/timeTracking";

export default function TimeTrackingWidget() {
  const auth = useAuth();
  const userId = auth?.user?.id;
  const organizationId = auth?.profile?.organization_id;
  const userName = auth?.profile?.full_name || auth?.user?.email || "User";

  const [activeSession, setActiveSession] = useState<TimeSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [todaySessions, setTodaySessions] = useState<TimeSession[]>([]);

  // Load active session on mount
  useEffect(() => {
    if (userId) {
      loadActiveSession();
      loadTodaySessions();
    }
  }, [userId]);

  // Update elapsed time every second when clocked in
  useEffect(() => {
    let interval: any;
    if (activeSession && activeSession.status === "active") {
      interval = setInterval(() => {
        const now = new Date();
        const clockIn = new Date(activeSession.clockIn);
        const elapsed = Math.floor((now.getTime() - clockIn.getTime()) / 1000);
        setElapsedTime(elapsed);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeSession]);

  const loadActiveSession = async () => {
    if (!userId) return;
    try {
      const session = await TimeTrackingService.getActiveSession(userId);
      setActiveSession(session);
      if (session) {
        const now = new Date();
        const clockIn = new Date(session.clockIn);
        const elapsed = Math.floor((now.getTime() - clockIn.getTime()) / 1000);
        setElapsedTime(elapsed);
      }
    } catch (error) {
      console.error("Error loading active session:", error);
    }
  };

  const loadTodaySessions = async () => {
    if (!userId) return;
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { sessions } = await TimeTrackingService.getSessions({
        userId,
        startDate: today.toISOString(),
        endDate: tomorrow.toISOString(),
        limit: 50,
      });
      setTodaySessions(sessions);
    } catch (error) {
      console.error("Error loading today's sessions:", error);
    }
  };

  const handleClockIn = async () => {
    if (!userId || !organizationId) return;
    setIsLoading(true);
    try {
      const session = await TimeTrackingService.clockIn({
        userId,
        organizationId,
        notes: notes || undefined,
      });
      setActiveSession(session);
      setNotes("");
      setShowNotes(false);
      loadTodaySessions();
    } catch (error) {
      console.error("Error clocking in:", error);
      alert("Failed to clock in. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!activeSession || !userId) return;
    setIsLoading(true);
    try {
      const session = await TimeTrackingService.clockOut({
        sessionId: activeSession.id,
        userId,
        notes: notes || undefined,
      });
      setActiveSession(null);
      setElapsedTime(0);
      setNotes("");
      setShowNotes(false);
      loadTodaySessions();
    } catch (error) {
      console.error("Error clocking out:", error);
      alert("Failed to clock out. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return "0h 0m";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getCurrentTime = () => {
    return new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getCurrentDate = () => {
    return new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  };

  const calculateTodayTotal = () => {
    return todaySessions.reduce((total, session) => total + (session.durationMinutes || 0), 0);
  };

  return (
    <div className="space-y-6">
      {/* Main Timer Card - Jibble Style */}
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-8 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-white">Welcome, {userName.split(' ')[0]}!</h2>
            <p className="text-white/60 mt-1">{getCurrentDate()}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-white">{getCurrentTime()}</p>
          </div>
        </div>

        {/* Active Session Timer */}
        {activeSession && activeSession.status === "active" ? (
          <div className="mb-8">
            <div className="rounded-2xl border-2 border-emerald-500/30 bg-emerald-500/10 p-8">
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/20 text-emerald-300 text-sm font-medium mb-4">
                  <Timer className="w-4 h-4" />
                  Currently Working
                </div>
                <div className="text-6xl font-bold text-white tracking-wider">
                  {formatTime(elapsedTime)}
                </div>
                <p className="text-white/60 mt-2">
                  Since {new Date(activeSession.clockIn).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>

              <button
                onClick={handleClockOut}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-red-500 to-rose-600 px-8 py-5 text-lg font-semibold text-white shadow-xl shadow-red-500/30 transition-all hover:from-red-600 hover:to-rose-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Pause className="w-6 h-6" />
                {isLoading ? "Clocking out..." : "Clock Out"}
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-8">
            <div className="rounded-2xl border-2 border-white/10 bg-white/5 p-8">
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-white/60 text-sm font-medium mb-4">
                  <Clock className="w-4 h-4" />
                  Ready to start
                </div>
                <div className="text-6xl font-bold text-white tracking-wider">
                  00:00:00
                </div>
                <p className="text-white/60 mt-2">Clock in to start tracking your time</p>
              </div>

              <button
                onClick={handleClockIn}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 px-8 py-5 text-lg font-semibold text-white shadow-xl shadow-emerald-500/30 transition-all hover:from-emerald-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play className="w-6 h-6" />
                {isLoading ? "Clocking in..." : "Clock In"}
              </button>
            </div>
          </div>
        )}

        {/* Notes Section */}
        <div className="space-y-3">
          <button
            onClick={() => setShowNotes(!showNotes)}
            className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
          >
            {showNotes ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {showNotes ? "Hide Notes" : "Add Notes"}
          </button>

          {showNotes && (
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What are you working on?"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
              rows={3}
            />
          )}
        </div>
      </div>

      {/* Today's Summary Card */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center justify-between w-full"
        >
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-white/60" />
            <span className="text-lg font-semibold text-white">Today's Summary</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-2xl font-bold text-white">{formatDuration(calculateTodayTotal())}</span>
            {showDetails ? <ChevronUp className="w-5 h-5 text-white/60" /> : <ChevronDown className="w-5 h-5 text-white/60" />}
          </div>
        </button>

        {showDetails && (
          <div className="mt-4 space-y-3">
            {todaySessions.length === 0 ? (
              <p className="text-center text-white/40 py-4">No sessions today</p>
            ) : (
              todaySessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between rounded-lg bg-white/5 p-4"
                >
                  <div>
                    <p className="text-sm font-medium text-white">
                      {new Date(session.clockIn).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {" - "}
                      {session.clockOut
                        ? new Date(session.clockOut).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Active"}
                    </p>
                    {session.notes && (
                      <p className="text-xs text-white/60 mt-1">{session.notes}</p>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-white">
                    {formatDuration(session.durationMinutes)}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
