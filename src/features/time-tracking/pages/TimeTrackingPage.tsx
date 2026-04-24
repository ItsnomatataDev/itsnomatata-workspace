import { useState } from "react";
import { useAuth } from "../../../app/providers/AuthProvider";
import JibbleTimeTracker from "../components/JibbleTimeTracker";
import AdminTimesheetView from "../components/AdminTimesheetView";

export default function TimeTrackingPage() {
  const auth = useAuth();
  const role = auth?.profile?.primary_role;
  const isAdmin = role === "admin";

  const [viewMode, setViewMode] = useState<"tracker" | "admin">(isAdmin ? "admin" : "tracker");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white">Time Tracking</h1>
              <p className="text-white/60 mt-2">Track your work hours and manage timesheets</p>
            </div>
            {isAdmin && (
              <div className="flex gap-2">
                <button
                  onClick={() => setViewMode("tracker")}
                  className={`px-6 py-3 rounded-xl font-medium transition-all ${
                    viewMode === "tracker"
                      ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                      : "bg-white/5 text-white/60 hover:bg-white/10"
                  }`}
                >
                  My Time
                </button>
                <button
                  onClick={() => setViewMode("admin")}
                  className={`px-6 py-3 rounded-xl font-medium transition-all ${
                    viewMode === "admin"
                      ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                      : "bg-white/5 text-white/60 hover:bg-white/10"
                  }`}
                >
                  Admin View
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        {viewMode === "tracker" ? (
          <JibbleTimeTracker />
        ) : (
          <AdminTimesheetView />
        )}
      </div>
    </div>
  );
}
