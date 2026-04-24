import { useState, useEffect } from "react";
import { Clock, Play, Pause, Calendar, Timer, TrendingUp, BarChart3, ChevronRight, ChevronLeft, Plus, Filter } from "lucide-react";
import { useAuth } from "../../../app/providers/AuthProvider";
import { TimeTrackingService } from "../services/timeTrackingService";
import type { TimeSession } from "../types/timeTracking";

export default function JibbleTimeTracker() {
  const auth = useAuth();
  const userId = auth?.user?.id;
  const organizationId = auth?.profile?.organization_id;
  const userName = auth?.profile?.full_name || auth?.user?.email || "User";

  const [activeSession, setActiveSession] = useState<TimeSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [todaySessions, setTodaySessions] = useState<TimeSession[]>([]);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [weekSessions, setWeekSessions] = useState<TimeSession[]>([]);

  useEffect(() => {
    if (userId) {
      loadActiveSession();
      loadTodaySessions();
      loadWeekSessions();
    }
  }, [userId, currentWeek]);

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

  const loadWeekSessions = async () => {
    if (!userId) return;
    try {
      const startOfWeek = new Date(currentWeek);
      const day = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
      startOfWeek.setDate(diff);
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 7);

      const { sessions } = await TimeTrackingService.getSessions({
        userId,
        startDate: startOfWeek.toISOString(),
        endDate: endOfWeek.toISOString(),
        limit: 100,
      });
      setWeekSessions(sessions);
    } catch (error) {
      console.error("Error loading week sessions:", error);
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
      loadWeekSessions();
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
      loadWeekSessions();
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

  const calculateWeekTotal = () => {
    return weekSessions.reduce((total, session) => total + (session.durationMinutes || 0), 0);
  };

  const getWeekDays = () => {
    const days = [];
    const startOfWeek = new Date(currentWeek);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      days.push(date);
    }
    return days;
  };

  const getDayTotal = (date: Date) => {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    return weekSessions
      .filter((session) => {
        const sessionDate = new Date(session.clockIn);
        return sessionDate >= dayStart && sessionDate < dayEnd;
      })
      .reduce((total, session) => total + (session.durationMinutes || 0), 0);
  };

  const changeWeek = (direction: "prev" | "next") => {
    const newWeek = new Date(currentWeek);
    newWeek.setDate(newWeek.getDate() + (direction === "next" ? 7 : -7));
    setCurrentWeek(newWeek);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white">Time Tracker</h1>
          <p className="text-white/60 mt-2">Track your time like a pro</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Timer & Today */}
          <div className="lg:col-span-2 space-y-6">
            {/* Main Timer Card */}
            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-8 shadow-2xl">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-white">Welcome, {userName.split(' ')[0]}!</h2>
                  <p className="text-white/60 mt-1">{getCurrentDate()}</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-white">{getCurrentTime()}</p>
                </div>
              </div>

              {activeSession && activeSession.status === "active" ? (
                <div className="rounded-2xl border-2 border-emerald-500/30 bg-emerald-500/10 p-8">
                  <div className="text-center mb-6">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/20 text-emerald-300 text-sm font-medium mb-4">
                      <Timer className="w-4 h-4" />
                      Currently Working
                    </div>
                    <div className="text-7xl font-bold text-white tracking-wider mb-2">
                      {formatTime(elapsedTime)}
                    </div>
                    <p className="text-white/60">
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
              ) : (
                <div className="rounded-2xl border-2 border-white/10 bg-white/5 p-8">
                  <div className="text-center mb-6">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-white/60 text-sm font-medium mb-4">
                      <Clock className="w-4 h-4" />
                      Ready to start
                    </div>
                    <div className="text-7xl font-bold text-white tracking-wider mb-2">
                      00:00:00
                    </div>
                    <p className="text-white/60">Clock in to start tracking your time</p>
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
              )}

              <div className="mt-6 space-y-3">
                <button
                  onClick={() => setShowNotes(!showNotes)}
                  className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
                >
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

            {/* Today's Sessions */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-white">Today's Sessions</h3>
                <span className="text-2xl font-bold text-emerald-400">{formatDuration(calculateTodayTotal())}</span>
              </div>

              {todaySessions.length === 0 ? (
                <p className="text-center text-white/40 py-8">No sessions today</p>
              ) : (
                <div className="space-y-3">
                  {todaySessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between rounded-lg bg-white/5 p-4 hover:bg-white/10 transition-all"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${
                            session.status === "active" ? "bg-emerald-400" : "bg-blue-400"
                          }`} />
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
                        </div>
                        {session.notes && (
                          <p className="text-xs text-white/60 mt-1 ml-5">{session.notes}</p>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-white ml-4">
                        {formatDuration(session.durationMinutes)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Weekly Overview */}
          <div className="space-y-6">
            {/* Weekly Summary Card */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Weekly Overview</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => changeWeek("prev")}
                    className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5 text-white/60" />
                  </button>
                  <button
                    onClick={() => changeWeek("next")}
                    className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <ChevronRight className="w-5 h-5 text-white/60" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="rounded-xl bg-emerald-500/10 p-4">
                  <div className="flex items-center gap-2 text-emerald-400 mb-2">
                    <Timer className="w-4 h-4" />
                    <span className="text-xs font-medium">Total</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{formatDuration(calculateWeekTotal())}</p>
                </div>
                <div className="rounded-xl bg-blue-500/10 p-4">
                  <div className="flex items-center gap-2 text-blue-400 mb-2">
                    <BarChart3 className="w-4 h-4" />
                    <span className="text-xs font-medium">Sessions</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{weekSessions.length}</p>
                </div>
              </div>

              {/* Week Days */}
              <div className="space-y-2">
                {getWeekDays().map((date, index) => {
                  const dayTotal = getDayTotal(date);
                  const isToday = date.toDateString() === new Date().toDateString();
                  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

                  return (
                    <div
                      key={index}
                      className={`flex items-center justify-between rounded-lg p-3 ${
                        isToday ? "bg-emerald-500/20 border border-emerald-500/30" : "bg-white/5"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-medium ${isToday ? "text-emerald-300" : "text-white/60"}`}>
                          {dayNames[index]}
                        </span>
                        <span className={`text-xs ${isToday ? "text-emerald-300" : "text-white/40"}`}>
                          {date.getDate()}
                        </span>
                      </div>
                      <span className={`text-sm font-semibold ${isToday ? "text-emerald-300" : "text-white"}`}>
                        {formatDuration(dayTotal)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Quick Stats</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white/60">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-sm">Today</span>
                  </div>
                  <span className="text-sm font-semibold text-white">{formatDuration(calculateTodayTotal())}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white/60">
                    <Calendar className="w-4 h-4" />
                    <span className="text-sm">This Week</span>
                  </div>
                  <span className="text-sm font-semibold text-white">{formatDuration(calculateWeekTotal())}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white/60">
                    <Timer className="w-4 h-4" />
                    <span className="text-sm">Avg/Day</span>
                  </div>
                  <span className="text-sm font-semibold text-white">
                    {formatDuration(Math.round(calculateWeekTotal() / 7))}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
