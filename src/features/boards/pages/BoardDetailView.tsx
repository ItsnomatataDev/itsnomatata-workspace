import React, { useState, useEffect, useCallback } from "react";
import {
  Clock,
  Users,
  DollarSign,
  TrendingUp,
  Calendar,
  Plus,
  ChevronDown,
  X,
  Timer,
  Activity,
  BarChart3,
  User,
  AlertCircle,
  CheckCircle2,
  BriefcaseBusiness,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import { useAuth } from "../../../app/providers/AuthProvider";
import { getBoard, createCard } from "../services/boardService";
import { getAdminTimeEntries } from "../../../lib/supabase/queries/adminTime";
import { getBoardTimeSettings, getBoardAssignments } from "../services/boardTimeService";
import { supabase } from "../../../lib/supabase/client";
import { useNavigate, useParams } from "react-router-dom";
import type { Board } from "../../../types/board";

interface TimeEntry {
  id: string;
  user_id: string;
  user_name: string;
  user_email?: string;
  task_name: string;
  duration_seconds: number;
  started_at: string;
  ended_at: string;
  is_billable: boolean;
  created_at: string;
}

interface MemberTimeData {
  user_id: string;
  user_name: string;
  user_email: string;
  total_hours: number;
  total_entries: number;
  average_hours_per_entry: number;
  last_activity: string;
}

interface TaskTimeData {
  task_id: string;
  task_name: string;
  total_hours: number;
  user_name: string;
  user_id: string;
  last_activity: string;
}

interface BoardSettings {
  estimatedHours: number;
  trackedHours: number;
  isBillable: boolean;
  billingType: "hourly" | "fixed";
  hourlyRate: number;
  fixedPrice: number;
}

export default function BoardDetailView() {
  const auth = useAuth();
  const navigate = useNavigate();
  const { boardId } = useParams<{ boardId: string }>();
  const organizationId = auth?.profile?.organization_id;
  const [board, setBoard] = useState<Board | null>(null);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [memberTimeData, setMemberTimeData] = useState<MemberTimeData[]>([]);
  const [taskTimeData, setTaskTimeData] = useState<TaskTimeData[]>([]);
  const [boardSettings, setBoardSettings] = useState<BoardSettings | null>(null);
  const [assignedUsers, setAssignedUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<"all" | "week" | "month">("all");
  const [sortBy, setSortBy] = useState<"hours" | "name" | "entries">("hours");
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");

  // Load board data
  const loadBoardData = useCallback(async () => {
    if (!boardId || !organizationId) return;

    try {
      setLoading(true);

      // Get board details
      const boardData = await getBoard(boardId);
      setBoard(boardData);

      // Get time entries
      const entries = await getAdminTimeEntries({
        organizationId,
        clientId: boardId,
        approvalStatus: "all",
        limit: 1000,
      });

      const formattedEntries: TimeEntry[] = entries.map((entry) => ({
        id: entry.id,
        user_id: entry.user_id,
        user_name: entry.user_name || "Unknown",
        user_email: entry.user_email || undefined,
        task_name: (entry as any).task_title || "Unknown Task",
        duration_seconds: entry.duration_seconds || 0,
        started_at: entry.started_at,
        ended_at: entry.ended_at || "",
        is_billable: entry.is_billable,
        created_at: entry.created_at,
      }));

      setTimeEntries(formattedEntries);

      // Get board settings
      const settings = await getBoardTimeSettings(boardId, organizationId);
      if (settings) {
        const totalTrackedSeconds = entries.reduce(
          (sum, entry) => sum + (entry.duration_seconds || 0),
          0
        );
        const totalTrackedHours = totalTrackedSeconds / 3600;

        setBoardSettings({
          estimatedHours: settings.estimatedHours || 0,
          trackedHours: totalTrackedHours,
          isBillable: settings.isBillable ?? true,
          billingType: settings.billingType || "hourly",
          hourlyRate: settings.hourlyRate || 0,
          fixedPrice: settings.fixedPrice || 0,
        });
      }

      // Get assigned users
      try {
        const assignedUserIds = await getBoardAssignments(boardId, organizationId);
        console.log("Assigned user IDs:", assignedUserIds);
        
        if (assignedUserIds.length > 0) {
          // Get user profiles for assigned users
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name, email")
            .in("id", assignedUserIds);

          const usersWithInitials = (profiles || []).map((profile: any) => ({
            ...profile,
            initials: (profile.full_name || profile.email || "?")
              .split(" ")
              .map((n: string) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2)
          }));
          
          setAssignedUsers(usersWithInitials);
          console.log("Assigned users loaded:", usersWithInitials);
        } else {
          setAssignedUsers([]);
        }
      } catch (error) {
        console.error("Failed to load assigned users:", error);
        setAssignedUsers([]);
      }

      // Process member time data
      const memberMap = new Map<string, MemberTimeData>();
      
      entries.forEach((entry) => {
        const userId = entry.user_id;
        const userName = entry.user_name || "Unknown";
        const duration = entry.duration_seconds || 0;
        const hours = duration / 3600;

        if (!memberMap.has(userId)) {
          memberMap.set(userId, {
            user_id: userId,
            user_name: userName,
            user_email: entry.user_email || "",
            total_hours: 0,
            total_entries: 0,
            average_hours_per_entry: 0,
            last_activity: entry.created_at || "",
          });
        }

        const member = memberMap.get(userId)!;
        member.total_hours += hours;
        member.total_entries += 1;
        member.last_activity = entry.created_at || "";
      });

      // Calculate averages and sort
      const members = Array.from(memberMap.values()).map((member) => ({
        ...member,
        average_hours_per_entry: member.total_entries > 0 ? member.total_hours / member.total_entries : 0,
      }));

      setMemberTimeData(members);

      // Process task time data
      const taskMap = new Map<string, TaskTimeData>();
      
      entries.forEach((entry) => {
        const taskId = entry.task_id || "unknown";
        const taskName = (entry as any).task_title || "Unknown Task";
        const duration = entry.duration_seconds || 0;
        const hours = duration / 3600;

        if (!taskMap.has(taskId)) {
          taskMap.set(taskId, {
            task_id: taskId,
            task_name: taskName,
            total_hours: 0,
            user_name: entry.user_name || "Unknown",
            user_id: entry.user_id,
            last_activity: entry.created_at,
          });
        }

        const task = taskMap.get(taskId)!;
        task.total_hours += hours;
        task.last_activity = entry.created_at || "";
      });

      setTaskTimeData(Array.from(taskMap.values()));

    } catch (error) {
      console.error("Failed to load board data:", error);
    } finally {
      setLoading(false);
    }
  }, [boardId, organizationId]);

  useEffect(() => {
    loadBoardData();
  }, [loadBoardData]);

  // Realtime subscription for time entries
  useEffect(() => {
    if (!organizationId || !boardId) return;

    const channel = supabase
      .channel('board-detail-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'time_entries',
          filter: `organization_id=eq.${organizationId}`,
        },
        () => {
          // Reload board data when time entries change
          loadBoardData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, boardId, loadBoardData]);

  // Filter entries by time period
  const getFilteredEntries = () => {
    if (timeFilter === "all") return timeEntries;
    
    const now = new Date();
    const filterDate = new Date();
    
    if (timeFilter === "week") {
      filterDate.setDate(now.getDate() - 7);
    } else if (timeFilter === "month") {
      filterDate.setMonth(now.getMonth() - 1);
    }

    return timeEntries.filter(
      (entry) => new Date(entry.created_at) >= filterDate
    );
  };

  // Sort member data
  const getSortedMembers = () => {
    const filteredEntries = getFilteredEntries();
    const memberMap = new Map<string, MemberTimeData>();

    filteredEntries.forEach((entry) => {
      const userId = entry.user_id;
      const duration = entry.duration_seconds || 0;
      const hours = duration / 3600;

      if (!memberMap.has(userId)) {
        memberMap.set(userId, {
          user_id: userId,
          user_name: entry.user_name || "Unknown",
          user_email: entry.user_email || "",
          total_hours: 0,
          total_entries: 0,
          average_hours_per_entry: 0,
          last_activity: entry.created_at || "",
        });
      }

      const member = memberMap.get(userId)!;
      member.total_hours += hours;
      member.total_entries += 1;
      member.last_activity = entry.created_at || "";
    });

    const members = Array.from(memberMap.values()).map((member) => ({
      ...member,
      average_hours_per_entry: member.total_entries > 0 ? member.total_hours / member.total_entries : 0,
    }));

    return members.sort((a, b) => {
      switch (sortBy) {
        case "hours":
          return b.total_hours - a.total_hours;
        case "name":
          return a.user_name.localeCompare(b.user_name);
        case "entries":
          return b.total_entries - a.total_entries;
        default:
          return 0;
      }
    });
  };

  const formatHours = (hours: number) => {
    if (hours >= 1) {
      return `${hours.toFixed(1)}h`;
    }
    return `${Math.round(hours * 60)}m`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Create task handler
  const handleCreateTask = async () => {
    if (!boardId || !organizationId || !newTaskTitle.trim()) return;

    try {
      await createCard(organizationId, boardId, {
        title: newTaskTitle.trim(),
        description: newTaskDescription.trim(),
      });

      // Reset form
      setNewTaskTitle("");
      setNewTaskDescription("");
      setIsCreateTaskModalOpen(false);

      // Reload board data
      loadBoardData();
    } catch (error) {
      console.error("Failed to create task:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-400"></div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Board not found</h2>
          <button
            onClick={() => navigate("/board-management")}
            className="px-4 py-2 bg-orange-500 text-black rounded-lg hover:bg-orange-400 transition"
          >
            Back to Boards
          </button>
        </div>
      </div>
    );
  }

  const sortedMembers = getSortedMembers();
  const filteredEntries = getFilteredEntries();
  const totalTrackedHours = filteredEntries.reduce((sum, entry) => sum + (entry.duration_seconds || 0) / 3600, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-gradient-to-r from-[#0a0a0a] to-[#111] px-6 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/board-management")}
              className="flex items-center gap-2 text-white/60 hover:text-white transition group"
            >
              <div className="p-2 rounded-lg bg-white/5 group-hover:bg-white/10 transition">
                <ChevronDown className="w-5 h-5 rotate-90" />
              </div>
              <span>Back to Boards</span>
            </button>
            <div className="h-8 w-px bg-white/10"></div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-white bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                  {board.name}
                </h1>
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                  boardSettings?.isBillable 
                    ? 'bg-green-500/20 text-green-400 border-green-500/30' 
                    : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                }`}>
                  {boardSettings?.isBillable ? (
                    <>
                      <DollarSign className="w-3 h-3" />
                      Billable
                    </>
                  ) : (
                    <>
                      <BriefcaseBusiness className="w-3 h-3" />
                      Internal
                    </>
                  )}
                </div>
              </div>
              <p className="text-white/50 mt-1">{board.notes || "No description"}</p>
            </div>
          </div>
          <button 
            onClick={() => setIsCreateTaskModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-black rounded-xl hover:from-orange-400 hover:to-orange-500 transition-all shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30"
          >
            <Plus className="w-4 h-4" />
            Create Task
          </button>
        </div>
      </div>

      {/* Budget Summary */}
      {boardSettings && (
        <div className="border-b border-white/10 bg-gradient-to-b from-[#0a0a0a] to-[#0d0d0d] px-6 py-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30">
              <DollarSign className="w-5 h-5 text-green-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">Budget Summary</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border border-orange-500/20 rounded-xl p-5 hover:border-orange-500/30 transition-all group">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-lg bg-orange-500/20 group-hover:bg-orange-500/30 transition">
                  <Clock className="w-4 h-4 text-orange-400" />
                </div>
                <span className="text-sm text-white/60">Estimated Hours</span>
              </div>
              <div className="text-3xl font-bold text-white group-hover:text-orange-400 transition-colors">
                {formatHours(boardSettings.estimatedHours)}
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-xl p-5 hover:border-blue-500/30 transition-all group">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-lg bg-blue-500/20 group-hover:bg-blue-500/30 transition">
                  <Timer className="w-4 h-4 text-blue-400" />
                </div>
                <span className="text-sm text-white/60">Tracked Hours</span>
              </div>
              <div className="text-3xl font-bold text-white group-hover:text-blue-400 transition-colors">
                {formatHours(totalTrackedHours)}
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/5 border border-green-500/20 rounded-xl p-5 hover:border-green-500/30 transition-all group">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-lg bg-green-500/20 group-hover:bg-green-500/30 transition">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                </div>
                <span className="text-sm text-white/60">Progress</span>
              </div>
              <div className="text-3xl font-bold text-white group-hover:text-green-400 transition-colors">
                {Math.round((totalTrackedHours / boardSettings.estimatedHours) * 100)}%
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 rounded-xl p-5 hover:border-purple-500/30 transition-all group">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-lg bg-purple-500/20 group-hover:bg-purple-500/30 transition">
                  <DollarSign className="w-4 h-4 text-purple-400" />
                </div>
                <span className="text-sm text-white/60">
                  {boardSettings.billingType === "hourly" ? "Hourly Rate" : "Fixed Price"}
                </span>
              </div>
              <div className="text-3xl font-bold text-white group-hover:text-purple-400 transition-colors">
                {boardSettings.billingType === "hourly" 
                  ? `$${boardSettings.hourlyRate}/hr`
                  : `$${boardSettings.fixedPrice}`
                }
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-white/60 font-medium">Budget Usage</span>
              <span className="text-sm font-semibold text-white">
                {Math.round((totalTrackedHours / boardSettings.estimatedHours) * 100)}%
              </span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-4 overflow-hidden">
              <div
                className={`h-4 rounded-full transition-all duration-500 ${
                  totalTrackedHours > boardSettings.estimatedHours
                    ? "bg-gradient-to-r from-red-500 to-red-600"
                    : totalTrackedHours > boardSettings.estimatedHours * 0.8
                    ? "bg-gradient-to-r from-orange-500 to-orange-600"
                    : "bg-gradient-to-r from-green-500 to-emerald-500"
                }`}
                style={{ 
                  width: `${Math.min((totalTrackedHours / boardSettings.estimatedHours) * 100, 100)}%` 
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Time Filter and Sort Controls */}
      <div className="border-b border-white/10 bg-gradient-to-b from-[#0d0d0d] to-[#0a0a0a] px-6 py-5">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-500/20 border border-blue-500/30">
              <Calendar className="w-4 h-4 text-blue-400" />
            </div>
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value as "all" | "week" | "month")}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-orange-400 transition"
            >
              <option value="all">All Time</option>
              <option value="week">Last Week</option>
              <option value="month">Last Month</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-purple-500/20 border border-purple-500/30">
              <BarChart3 className="w-4 h-4 text-purple-400" />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "hours" | "name" | "entries")}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-orange-400 transition"
            >
              <option value="hours">Sort by Hours</option>
              <option value="name">Sort by Name</option>
              <option value="entries">Sort by Entries</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="flex-1 p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Members Time Tracking */}
          <div className="bg-gradient-to-br from-[#0a0a0a] to-[#0d0d0d] border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-600/20 border border-orange-500/30">
                <Users className="w-5 h-5 text-orange-400" />
              </div>
              <h2 className="text-xl font-semibold text-white">Member Time Tracking</h2>
            </div>
            
            <div className="space-y-3">
              {sortedMembers.map((member, index) => (
                <div
                  key={member.user_id}
                  className="flex items-center justify-between p-4 bg-gradient-to-r from-white/5 to-transparent border border-white/10 rounded-xl hover:from-white/10 hover:border-white/20 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-600/20 border border-orange-500/30 flex items-center justify-center text-sm font-bold text-orange-400 group-hover:scale-110 transition-transform">
                      {member.user_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                    </div>
                    <div>
                      <div className="font-semibold text-white">{member.user_name}</div>
                      <div className="text-sm text-white/50">
                        {member.total_entries} entries • Last: {formatDate(member.last_activity)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg text-white group-hover:text-orange-400 transition-colors">{formatHours(member.total_hours)}</div>
                    <div className="text-sm text-white/50">
                      Avg: {formatHours(member.average_hours_per_entry)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Assigned Team Members */}
          <div className="bg-gradient-to-br from-[#0a0a0a] to-[#0d0d0d] border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/30">
                <Users className="w-5 h-5 text-purple-400" />
              </div>
              <h2 className="text-xl font-semibold text-white">Assigned Team Members</h2>
            </div>
            
            {assignedUsers.length > 0 ? (
              <div className="space-y-3">
                {assignedUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 bg-gradient-to-r from-white/5 to-transparent border border-white/10 rounded-xl hover:from-white/10 hover:border-white/20 transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/30 flex items-center justify-center text-sm font-bold text-purple-400 group-hover:scale-110 transition-transform">
                        {user.initials}
                      </div>
                      <div>
                        <div className="font-semibold text-white">{user.full_name || 'Unknown User'}</div>
                        <div className="text-sm text-white/50">{user.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-xl group-hover:from-green-500/30 transition-all">
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                      <span className="text-sm font-medium text-green-400">Assigned</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/10">
                  <Users className="w-8 h-8 text-white/30" />
                </div>
                <p className="text-white/50 text-sm">No team members assigned to this board yet</p>
              </div>
            )}
          </div>

          {/* Tasks with Most Time */}
          <div className="bg-gradient-to-br from-[#0a0a0a] to-[#0d0d0d] border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all lg:col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30">
                <Activity className="w-5 h-5 text-blue-400" />
              </div>
              <h2 className="text-xl font-semibold text-white">Tasks with Most Time</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {taskTimeData
                .sort((a, b) => b.total_hours - a.total_hours)
                .slice(0, 6)
                .map((task, index) => (
                  <div
                    key={task.task_id}
                    className="flex items-center justify-between p-4 bg-gradient-to-r from-white/5 to-transparent border border-white/10 rounded-xl hover:from-white/10 hover:border-white/20 transition-all group"
                  >
                    <div className="flex-1">
                      <div className="font-semibold text-white mb-1">{task.task_name}</div>
                      <div className="text-sm text-white/50">
                        by {task.user_name} • {formatDate(task.last_activity)}
                      </div>
                    </div>
                    <div className="ml-4 px-4 py-2 bg-gradient-to-r from-blue-500/20 to-blue-600/20 border border-blue-500/30 rounded-xl group-hover:from-blue-500/30 transition-all">
                      <div className="font-bold text-white">{formatHours(task.total_hours)}</div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Time Sheet by Project */}
        <div className="mt-6 bg-gradient-to-br from-[#0a0a0a] to-[#0d0d0d] border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30">
              <BarChart3 className="w-5 h-5 text-green-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">Time Sheet by Project</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-white">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-4 px-4 text-sm font-semibold text-white/60">User</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-white/60">Task</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-white/60">Duration</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-white/60">Date</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-white/60">Billable</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .map((entry) => (
                    <tr key={entry.id} className="border-b border-white/5 hover:bg-white/5 transition">
                      <td className="py-4 px-4">
                        <div className="font-semibold">{entry.user_name}</div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="text-white/80">{entry.task_name}</div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-orange-400" />
                          <span className="font-semibold">{formatHours(entry.duration_seconds / 3600)}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="text-white/60">{formatDate(entry.created_at)}</div>
                      </td>
                      <td className="py-4 px-4">
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                          entry.is_billable 
                            ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 border-green-500/30'
                            : 'bg-gradient-to-r from-red-500/20 to-red-600/20 text-red-400 border-red-500/30'
                        }`}>
                          {entry.is_billable ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Billable
                            </>
                          ) : (
                            <>
                              <X className="w-3.5 h-3.5" />
                              Non-billable
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create Task Modal */}
        {isCreateTaskModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-[#0a0a0a] border border-white/20 rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Create New Task</h2>
              <button
                onClick={() => setIsCreateTaskModalOpen(false)}
                className="p-1 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Task Title
                </label>
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-orange-400"
                  placeholder="Enter task title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Description
                </label>
                <textarea
                  value={newTaskDescription}
                  onChange={(e) => setNewTaskDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-orange-400"
                  placeholder="Enter task description"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => setIsCreateTaskModalOpen(false)}
                className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white hover:bg-white/20 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTask}
                className="flex-1 px-4 py-2 bg-orange-500 text-black rounded-lg hover:bg-orange-400 transition flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create Task
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
