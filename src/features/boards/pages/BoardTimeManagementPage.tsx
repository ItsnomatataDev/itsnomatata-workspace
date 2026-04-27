import React, { useState, useEffect, useCallback } from "react";
import {
  Clock,
  Users,
  DollarSign,
  Eye,
  Edit2,
  Plus,
  Search,
  Filter,
  MoreVertical,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  X,
  Save,
  LayoutDashboard,
  Settings,
  TrendingUp,
  Calendar,
  BriefcaseBusiness,
  Briefcase,
  Trash2,
} from "lucide-react";
import { useAuth } from "../../../app/providers/AuthProvider";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import { getBoards, createCard, updateCard, createBoard, deleteBoard } from "../services/boardService";
import { createClient } from "../../clients/services/clientService";
import { getAdminTimeEntries } from "../../../lib/supabase/queries/adminTime";
import { supabase } from "../../../lib/supabase/client";
import { getBoardTimeSettings, updateBoardTimeSettings, assignUsersToBoard, getBoardAssignments } from "../services/boardTimeService";
import type { Board } from "../../../types/board";

interface BoardTimeData extends Board {
  boardType?: "client" | "internal";
  estimatedHours?: number;
  trackedHours?: number;
  assignedUsers?: BoardAssignee[];
  isBillable?: boolean;
  billingType?: "fixed" | "hourly";
  hourlyRate?: number;
  fixedPrice?: number;
  memberCount?: number;
  recentActivityAt?: string;
  description?: string;
  originalName?: string;
  originalDescription?: string;
  originalBoardType?: "client" | "internal";
}

interface BoardAssignee {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  initials: string;
  avatar?: string;
}

interface CreateBoardForm {
  name: string;
  description: string;
  boardType: "client" | "internal";
  estimatedHours: number;
  isBillable: boolean;
  billingType: "hourly" | "fixed";
  hourlyRate: number;
  fixedPrice: number;
}

export default function BoardTimeManagementPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const organizationId = auth?.profile?.organization_id;
  const [boards, setBoards] = useState<BoardTimeData[]>([]);
  const [filteredBoards, setFilteredBoards] = useState<BoardTimeData[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [selectedBoard, setSelectedBoard] = useState<BoardTimeData | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [editingBoard, setEditingBoard] = useState<BoardTimeData | null>(null);
  const [editForm, setEditForm] = useState<CreateBoardForm>({
    name: "",
    description: "",
    boardType: "client",
    estimatedHours: 40,
    isBillable: true,
    billingType: "hourly",
    hourlyRate: 100,
    fixedPrice: 5000,
  });
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [createForm, setCreateForm] = useState<CreateBoardForm>({
    name: "",
    description: "",
    boardType: "client",
    estimatedHours: 40,
    isBillable: true,
    billingType: "hourly",
    hourlyRate: 100,
    fixedPrice: 5000,
  });
  const [editFormErrors, setEditFormErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Realtime subscription for time entries
  useEffect(() => {
    if (!organizationId) return;

    const channel = supabase
      .channel('time-entries-board-management')
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
          loadBoardsWithTimeData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId]);

  // Load boards with time data
  const loadBoardsWithTimeData = useCallback(async () => {
    if (!organizationId) return;

    try {
      setLoading(true);

      // Get all boards (clients)
      const boardsData = await getBoards(organizationId);

      // Get time entries for all boards
      const timeEntries = await getAdminTimeEntries({
        organizationId,
        approvalStatus: "all",
        limit: 1000,
      });

      // Get organization members
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("organization_id", organizationId);

      const profileMap = new Map(
        (profiles ?? []).map((p) => [p.id, p]),
      );

      const boardsWithTimeData: BoardTimeData[] = await Promise.all(
        boardsData.map(async (board) => {
          // Calculate tracked hours for this board
          const boardTimeEntries = timeEntries.filter(
            (entry) => entry.client_id === board.id,
          );

          const trackedSeconds = boardTimeEntries.reduce(
            (sum, entry) => sum + (entry.duration_seconds || 0),
            0,
          );

          const trackedHours = trackedSeconds / 3600;

          // Get board time settings
          const settings = await getBoardTimeSettings(board.id, organizationId);
          
          // Get board assignments
          const assignedUserIds = await getBoardAssignments(board.id, organizationId);
          
          // Fetch profiles for assigned users if not in profileMap
          let assignedUserProfiles = (profiles ?? []).filter(p => assignedUserIds.includes(p.id));
          
          // If some assigned users are not in the organization profiles, fetch them separately
          const missingUserIds = assignedUserIds.filter(id => !profileMap.has(id));
          if (missingUserIds.length > 0) {
            const { data: additionalProfiles } = await supabase
              .from("profiles")
              .select("id, full_name, email")
              .in("id", missingUserIds);
            
            if (additionalProfiles) {
              assignedUserProfiles = [...assignedUserProfiles, ...additionalProfiles];
              additionalProfiles.forEach(p => profileMap.set(p.id, p));
            }
          }
          
          const assignedUsers: BoardAssignee[] = assignedUserIds
            .map((userId) => {
              const profile = profileMap.get(userId);
              if (!profile) return null;
              
              const initials = (profile.full_name || profile.email || "?")
                .split(" ")
                .map((n: string) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);

              return {
                id: profile.id,
                user_id: profile.id,
                full_name: profile.full_name,
                email: profile.email,
                initials,
              };
            })
            .filter((user): user is BoardAssignee => user !== null);

          return {
            ...board,
            estimatedHours: settings?.estimatedHours || 40,
            trackedHours,
            assignedUsers,
            isBillable: settings?.isBillable ?? true,
            billingType: settings?.billingType || "hourly",
            hourlyRate: settings?.hourlyRate || 100,
            fixedPrice: settings?.fixedPrice || 5000,
            memberCount: assignedUsers.length,
            recentActivityAt: board.updated_at,
          };
        }),
      );

      setBoards(boardsWithTimeData);
      setFilteredBoards(boardsWithTimeData);
    } catch (error) {
      console.error("Failed to load boards:", error);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  // Load users for assignment
  const loadUsers = useCallback(async () => {
    if (!organizationId) return;

    try {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("organization_id", organizationId)
        .order("full_name");

      setUsers(profiles || []);
    } catch (error) {
      console.error("Failed to load users:", error);
    }
  }, [organizationId]);

  useEffect(() => {
    loadBoardsWithTimeData();
    loadUsers();
  }, [loadBoardsWithTimeData, loadUsers]);

  // Filter and sort boards
  useEffect(() => {
    let filtered = [...boards];

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter((board) =>
        board.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        board.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply status filter
    if (filterStatus !== "all") {
      filtered = filtered.filter((board) => {
        const progress = (board.trackedHours || 0) / (board.estimatedHours || 1) * 100;
        switch (filterStatus) {
          case "over-budget":
            return progress >= 100;
          case "on-track":
            return progress < 100 && progress >= 50;
          case "behind":
            return progress < 50;
          case "billable":
            return board.isBillable;
          case "non-billable":
            return !board.isBillable;
          default:
            return true;
        }
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "tracked":
          return (b.trackedHours || 0) - (a.trackedHours || 0);
        case "progress":
          const aProgress = (a.trackedHours || 0) / (a.estimatedHours || 1) * 100;
          const bProgress = (b.trackedHours || 0) / (b.estimatedHours || 1) * 100;
          return bProgress - aProgress;
        case "members":
          return (b.memberCount || 0) - (a.memberCount || 0);
        default:
          return 0;
      }
    });

    setFilteredBoards(filtered);
  }, [boards, searchQuery, filterStatus, sortBy]);

  const formatHours = (hours: number) => {
    if (hours >= 1) {
      return `${hours.toFixed(1)}h`;
    }
    return `${Math.round(hours * 60)}m`;
  };

  const getProgressPercentage = (tracked: number, estimated: number) => {
    if (estimated === 0) return 0;
    return Math.round((tracked / estimated) * 100);
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return "bg-red-500";
    if (percentage >= 80) return "bg-orange-500";
    return "bg-green-500";
  };

  const handleCreateBoard = async () => {
    if (!organizationId) return;

    setIsSaving(true);
    setEditFormErrors({});

    try {
      console.log("Creating new board:", createForm.name);

      // Validate form
      if (!createForm.name.trim()) {
        throw new Error("Board name is required");
      }

      if (createForm.estimatedHours <= 0) {
        throw new Error("Time estimate must be greater than 0");
      }

      if (createForm.isBillable) {
        if (createForm.billingType === "hourly" && (!createForm.hourlyRate || createForm.hourlyRate <= 0)) {
          throw new Error("Hourly rate must be greater than 0");
        }
        if (createForm.billingType === "fixed" && (!createForm.fixedPrice || createForm.fixedPrice <= 0)) {
          throw new Error("Fixed price must be greater than 0");
        }
      }

      // Create board (client) using the same service as user board creation
      const newBoard = await createClient({
        organizationId,
        name: createForm.name.trim(),
        notes: createForm.description?.trim() || null,
        boardType: createForm.boardType,
      });

      console.log("Board created successfully:", newBoard.id);

      // Set time settings
      await updateBoardTimeSettings(newBoard.id, organizationId, {
        estimatedHours: createForm.estimatedHours,
        isBillable: createForm.isBillable,
        billingType: createForm.billingType,
        hourlyRate: createForm.hourlyRate,
        fixedPrice: createForm.fixedPrice,
      });

      console.log("Time settings created successfully");

      // Auto-assign the board creator as a member
      if (auth?.profile?.id) {
        await assignUsersToBoard(
          newBoard.id,
          organizationId,
          [auth.profile.id],
          newBoard.name,
          auth.profile.id
        );
        console.log("Board creator assigned successfully");
      }

      // Assign additional users if selected
      if (selectedUsers.length > 0) {
        await assignUsersToBoard(
          newBoard.id, 
          organizationId, 
          selectedUsers, 
          newBoard.name, 
          auth?.profile?.id
        );
        console.log("Additional users assigned successfully");
      }

      // Reset form and reload
      setCreateForm({
        name: "",
        description: "",
        boardType: "client",
        estimatedHours: 40,
        isBillable: true,
        billingType: "hourly",
        hourlyRate: 100,
        fixedPrice: 5000,
      });
      setSelectedUsers([]);
      setIsCreateModalOpen(false);
      
      // Reload data to ensure synchronization
      await loadBoardsWithTimeData();
      console.log("Board creation completed successfully");

    } catch (error) {
      console.error("Failed to create board:", error);
      let errorMessage = "Failed to create board. Please try again.";
      
      if (error instanceof Error) {
        if (error.message.includes("permission")) {
          errorMessage = "You don't have permission to create boards.";
        } else if (error.message.includes("network")) {
          errorMessage = "Network error. Please check your connection.";
        } else if (error.message.includes("duplicate")) {
          errorMessage = "A board with this name already exists.";
        } else {
          errorMessage = error.message;
        }
      }
      
      setEditFormErrors({
        submit: errorMessage
      });
    } finally {
      setIsSaving(false);
    }
  };

  const validateEditForm = () => {
    const errors: Record<string, string> = {};
    
    if (!editingBoard?.name?.trim()) {
      errors.name = "Board name is required";
    }
    
    if (editingBoard?.estimatedHours !== undefined && editingBoard.estimatedHours <= 0) {
      errors.estimatedHours = "Time estimate must be greater than 0";
    }
    
    if (editingBoard?.isBillable) {
      if (editingBoard.billingType === "hourly" && (!editingBoard.hourlyRate || editingBoard.hourlyRate <= 0)) {
        errors.hourlyRate = "Hourly rate must be greater than 0";
      }
      if (editingBoard.billingType === "fixed" && (!editingBoard.fixedPrice || editingBoard.fixedPrice <= 0)) {
        errors.fixedPrice = "Fixed price must be greater than 0";
      }
    }
    
    setEditFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleEditBoard = async () => {
    if (!editingBoard || !organizationId) return;
    
    if (!validateEditForm()) {
      return;
    }

    setIsSaving(true);
    setEditFormErrors({});

    try {
      console.log("Updating board:", editingBoard.id, "for organization:", organizationId);

      // Check if name is being changed and if it conflicts with another board
      if (editingBoard.name !== editingBoard.originalName) {
        const trimmedName = editingBoard.name.trim();
        const { data: existingBoard } = await supabase
          .from("clients")
          .select("id, name")
          .eq("organization_id", organizationId)
          .eq("name", trimmedName)
          .single();

        if (existingBoard && existingBoard.id !== editingBoard.id) {
          setEditFormErrors({
            name: "A board with this name already exists."
          });
          setIsSaving(false);
          return;
        }
      }

      // Update board basic info if changed
      if (editingBoard.name !== editingBoard.originalName || editingBoard.description !== editingBoard.originalDescription || editingBoard.boardType !== editingBoard.originalBoardType) {
        console.log("Updating board basic info...");
        const { error: boardUpdateError } = await supabase
          .from("clients")
          .update({
            name: editingBoard.name.trim(),
            notes: editingBoard.description?.trim() || null,
            board_type: editingBoard.boardType,
            updated_at: new Date().toISOString()
          })
          .eq("id", editingBoard.id)
          .eq("organization_id", organizationId);

        if (boardUpdateError) {
          console.error("Board update error:", boardUpdateError);
          throw new Error(`Failed to update board info: ${boardUpdateError.message}`);
        }
        console.log("Board basic info updated successfully");
      }

      // Update board time settings
      console.log("Updating board time settings...");
      try {
        await updateBoardTimeSettings(editingBoard.id, organizationId, {
          estimatedHours: editingBoard.estimatedHours,
          isBillable: editingBoard.isBillable,
          billingType: editingBoard.billingType,
          hourlyRate: editingBoard.hourlyRate,
          fixedPrice: editingBoard.fixedPrice,
        });
        console.log("Board time settings updated successfully");
      } catch (timeSettingsError) {
        console.error("Time settings update error:", timeSettingsError);
        const errorMessage = timeSettingsError instanceof Error ? timeSettingsError.message : 'Unknown error';
        throw new Error(`Failed to update time settings: ${errorMessage}`);
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      
      setIsEditModalOpen(false);
      setEditingBoard(null);
      
      // Reload data to ensure synchronization
      console.log("Reloading board data...");
      await loadBoardsWithTimeData();
      console.log("Board data reloaded successfully");
      
    } catch (error) {
      console.error("Failed to update board:", error);
      let errorMessage = "Failed to save changes. Please try again.";
      
      if (error instanceof Error) {
        if (error.message.includes("permission")) {
          errorMessage = "You don't have permission to update this board.";
        } else if (error.message.includes("network")) {
          errorMessage = "Network error. Please check your connection.";
        } else {
          errorMessage = error.message;
        }
      }
      
      setEditFormErrors({
        submit: errorMessage
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAssignUsers = async () => {
    if (!selectedBoard || !organizationId) return;

    setIsSaving(true);
    try {
      await assignUsersToBoard(selectedBoard.id, organizationId, selectedUsers);
      setSelectedUsers([]);
      setIsAssignModalOpen(false);
      await loadBoardsWithTimeData();
    } catch (error) {
      console.error("Failed to assign users:", error);
      let errorMessage = "Failed to assign users. Please try again.";
      
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      setEditFormErrors({
        submit: errorMessage
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteBoard = async (boardId: string, boardName: string) => {
    if (!organizationId) return;
    
    // Confirm deletion
    const confirmed = window.confirm(
      `Are you sure you want to delete "${boardName}"? This action cannot be undone and all associated tasks will be unassigned.`
    );
    
    if (!confirmed) return;

    setIsSaving(true);
    try {
      console.log("Deleting board:", boardId);
      
      await deleteBoard(organizationId, boardId);
      console.log("Board deleted successfully");
      
      // Reload data to ensure synchronization
      await loadBoardsWithTimeData();
      console.log("Board data reloaded after deletion");
      
    } catch (error) {
      console.error("Failed to delete board:", error);
      let errorMessage = "Failed to delete board. Please try again.";
      
      if (error instanceof Error) {
        if (error.message.includes("permission")) {
          errorMessage = "You don't have permission to delete this board.";
        } else if (error.message.includes("foreign")) {
          errorMessage = "Cannot delete board with existing tasks. Please delete tasks first.";
        } else {
          errorMessage = error.message;
        }
      }
      
      alert(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-400"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen">
        <Sidebar role={auth?.profile?.primary_role} />

      {/* Main Content */}
        <main className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b border-white/10 bg-[#0a0a0a] px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">Board Management</h1>
              <p className="text-white/60">
                Manage time estimates, billing, and team assignments for your boards
              </p>
            </div>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-black rounded-lg hover:bg-orange-400 transition"
            >
              <Plus className="w-4 h-4" />
              New Board
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/40 w-4 h-4" />
              <input
                type="text"
                placeholder="Search boards..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-orange-400"
              />
            </div>
            
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-orange-400"
            >
              <option value="all">All Boards</option>
              <option value="over-budget">Over Budget</option>
              <option value="on-track">On Track</option>
              <option value="behind">Behind</option>
              <option value="billable">Billable</option>
              <option value="non-billable">Non-Billable</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-orange-400"
            >
              <option value="name">Sort by Name</option>
              <option value="tracked">Sort by Hours Tracked</option>
              <option value="progress">Sort by Progress</option>
              <option value="members">Sort by Members</option>
            </select>

            <button className="flex items-center gap-2 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white hover:bg-white/20 transition">
              <Filter className="w-4 h-4" />
              Filters
            </button>
          </div>
        </div>

        {/* Boards Table */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-4 px-6 text-sm font-medium text-white/60">Name</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-white/60">Members</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-white/60">Budget</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-white/60">Tracked</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-white/60">Billing</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-white/60">Progress</th>
                  <th className="text-right py-4 px-6 text-sm font-medium text-white/60">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBoards.map((board) => {
                  const isInternal = board.boardType === 'internal';
                  const progressPercentage = isInternal 
                    ? 0 
                    : getProgressPercentage(
                        board.trackedHours || 0,
                        board.estimatedHours || 0,
                      );
                  const progressColor = getProgressColor(progressPercentage);

                  return (
                    <tr key={board.id} className="border-b border-white/5 hover:bg-white/5 transition">
                      {/* Name */}
                      <td className="py-4 px-6">
                        <div>
                          <button
                            onClick={() => navigate(`/board-details/${board.id}`)}
                            className="font-medium text-white hover:text-orange-400 transition-colors text-left"
                          >
                            {board.name}
                          </button>
                          <div className="text-sm text-white/40 mt-1">
                            {board.description || "No description"}
                          </div>
                        </div>
                      </td>

                      {/* Members */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center -space-x-2">
                            {(board.assignedUsers || []).slice(0, 3).map((user) => (
                              <div
                                key={user.id}
                                className="w-6 h-6 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-xs font-medium text-orange-400"
                              >
                                {user.initials}
                              </div>
                            ))}
                            {((board.assignedUsers || []).length || 0) > 3 && (
                              <div className="w-6 h-6 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-xs font-medium text-white/60">
                                +{((board.assignedUsers || []).length || 0) - 3}
                              </div>
                            )}
                            {(board.assignedUsers || []).length === 0 && (
                              <div className="w-6 h-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                                <Users className="w-3 h-3 text-white/30" />
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg">
                            <Users className="w-3.5 h-3.5 text-white/50" />
                            <span className="text-sm font-semibold text-white">
                              {(board.assignedUsers || []).length}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Budget */}
                      <td className="py-4 px-6">
                        <div className="text-sm font-medium text-white">
                          {isInternal ? 'Unlimited' : formatHours(board.estimatedHours || 0)}
                        </div>
                      </td>

                      {/* Tracked */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-orange-400" />
                          <span className="text-sm font-medium text-white">
                            {formatHours(board.trackedHours || 0)}
                          </span>
                        </div>
                      </td>

                      {/* Billing */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                            board.boardType === 'internal'
                              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                              : board.isBillable 
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                          }`}>
                            {board.boardType === 'internal' ? (
                              <>
                                <BriefcaseBusiness className="w-3 h-3" />
                                Internal
                              </>
                            ) : (
                              <>
                                <DollarSign className="w-3 h-3" />
                                {board.isBillable ? 'Billable' : 'Non-billable'}
                              </>
                            )}
                          </div>
                          <span className="text-xs text-white/40">
                            {board.billingType === 'hourly' 
                              ? `$${board.hourlyRate}/hr` 
                              : board.billingType === 'fixed' 
                              ? `$${board.fixedPrice}` 
                              : ''
                            }
                          </span>
                        </div>
                      </td>

                      {/* Progress */}
                      <td className="py-4 px-6">
                        {isInternal ? (
                          <span className="text-xs text-blue-400 font-medium">Unlimited</span>
                        ) : (
                          <div className="w-24">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-white/60">{progressPercentage}%</span>
                            </div>
                            <div className="w-full bg-white/10 rounded-full h-1.5">
                              <div
                                className={`${progressColor} h-1.5 rounded-full transition-all duration-300`}
                                style={{ width: `${Math.min(progressPercentage, 100)}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedBoard(board);
                              setIsAssignModalOpen(true);
                            }}
                            className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition"
                            title="Assign Users"
                          >
                            <Users className="w-4 h-4" />
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingBoard({
                                ...board,
                                originalName: board.name,
                                originalDescription: board.description || "",
                                originalBoardType: board.boardType || "client"
                              });
                              setIsEditModalOpen(true);
                              setEditFormErrors({});
                              setSaveSuccess(false);
                            }}
                            className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition"
                            title="Edit Settings"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => navigate(`/board-details/${board.id}`)}
                            className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDeleteBoard(board.id, board.name)}
                            className="p-1.5 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                            title="Delete Board"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Empty State */}
            {filteredBoards.length === 0 && !loading && (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Briefcase className="w-8 h-8 text-white/40" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">No boards found</h3>
                <p className="text-white/60 mb-6">
                  {searchQuery ? "Try adjusting your search or filters" : "Get started by creating your first board"}
                </p>
                {!searchQuery && (
                  <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="px-6 py-2 bg-orange-500 text-black rounded-lg hover:bg-orange-400 transition"
                  >
                    Create Board
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

      {/* Create Board Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-[#0a0a0a] border border-white/20 rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Create New Board</h2>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Board Name
                </label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({...createForm, name: e.target.value})}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-orange-400"
                  placeholder="Enter board name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Description
                </label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm({...createForm, description: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-orange-400"
                  placeholder="Enter board description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Board Type
                </label>
                <select
                  value={createForm.boardType}
                  onChange={(e) => setCreateForm({...createForm, boardType: e.target.value as "client" | "internal", isBillable: e.target.value === "client" ? createForm.isBillable : false})}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-orange-400"
                >
                  <option value="client">Client Board (Billable)</option>
                  <option value="internal">Internal Board (Non-billable)</option>
                </select>
                <p className="mt-1 text-xs text-white/40">
                  {createForm.boardType === "client" 
                    ? "Client boards track billable work for external clients" 
                    : "Internal boards track company-internal work without billing"}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Time Estimate (hours)
                </label>
                <input
                  type="number"
                  value={createForm.estimatedHours}
                  onChange={(e) => setCreateForm({...createForm, estimatedHours: parseFloat(e.target.value) || 0})}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-orange-400"
                  placeholder="40"
                />
              </div>

              {createForm.boardType === "client" && (
                <>
                  <div>
                    <label className="flex items-center gap-2 mb-4">
                      <input
                        type="checkbox"
                        checked={createForm.isBillable}
                        onChange={(e) => setCreateForm({...createForm, isBillable: e.target.checked})}
                        className="rounded border-white/20 bg-white/10 text-orange-500 focus:ring-orange-500"
                      />
                      <span className="text-sm text-white">Billable client</span>
                    </label>
                  </div>

                  {createForm.isBillable && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-white mb-2">
                          Billing Type
                        </label>
                        <select
                          value={createForm.billingType}
                          onChange={(e) => setCreateForm({...createForm, billingType: e.target.value as "hourly" | "fixed"})}
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-orange-400"
                        >
                          <option value="hourly">Hourly</option>
                          <option value="fixed">Fixed Price</option>
                        </select>
                      </div>

                      {createForm.billingType === "hourly" ? (
                        <div>
                          <label className="block text-sm font-medium text-white mb-2">
                            Hourly Rate ($)
                          </label>
                          <input
                            type="number"
                            value={createForm.hourlyRate}
                            onChange={(e) => setCreateForm({...createForm, hourlyRate: parseFloat(e.target.value) || 0})}
                            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-orange-400"
                            placeholder="100"
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="block text-sm font-medium text-white mb-2">
                            Fixed Price ($)
                          </label>
                          <input
                            type="number"
                            value={createForm.fixedPrice}
                            onChange={(e) => setCreateForm({...createForm, fixedPrice: parseFloat(e.target.value) || 0})}
                            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-orange-400"
                            placeholder="5000"
                          />
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Assign Users
                </label>
                <div className="max-h-32 overflow-y-auto border border-white/20 rounded-lg p-2">
                  {users.map((user) => (
                    <label key={user.id} className="flex items-center gap-2 p-1 hover:bg-white/10 rounded">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedUsers([...selectedUsers, user.id]);
                          } else {
                            setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                          }
                        }}
                        className="rounded border-white/20 bg-white/10 text-orange-500 focus:ring-orange-500"
                      />
                      <span className="text-sm text-white">
                        {user.full_name || user.email}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white hover:bg-white/20 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBoard}
                className="flex-1 px-4 py-2 bg-orange-500 text-black rounded-lg hover:bg-orange-400 transition flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create Board
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Board Modal */}
      {isEditModalOpen && editingBoard && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-[#0a0a0a] border border-white/20 rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">
                Edit Board Settings
              </h2>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {saveSuccess && (
              <div className="mb-4 p-3 bg-green-500/20 border border-green-500/30 rounded-lg">
                <div className="flex items-center gap-2 text-green-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-sm font-medium">Board settings updated successfully!</span>
                </div>
              </div>
            )}

            {editFormErrors.submit && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
                <div className="flex items-center gap-2 text-red-400">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">{editFormErrors.submit}</span>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Board Name <span className="text-orange-500">*</span>
                </label>
                <input
                  type="text"
                  value={editingBoard.name || ""}
                  onChange={(e) => {
                    setEditingBoard({
                      ...editingBoard,
                      name: e.target.value,
                    });
                    setEditFormErrors({ ...editFormErrors, name: "" });
                  }}
                  className={`w-full px-3 py-2 bg-white/10 border rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-orange-400 ${
                    editFormErrors.name ? "border-red-500" : "border-white/20"
                  }`}
                  placeholder="Enter board name"
                />
                {editFormErrors.name && (
                  <p className="mt-1 text-xs text-red-400">{editFormErrors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Description
                </label>
                <textarea
                  value={editingBoard.description || ""}
                  onChange={(e) => {
                    setEditingBoard({
                      ...editingBoard,
                      description: e.target.value,
                    });
                  }}
                  rows={3}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-orange-400 resize-none"
                  placeholder="Enter board description (optional)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Board Type
                </label>
                <select
                  value={editingBoard.boardType || "client"}
                  onChange={(e) => {
                    setEditingBoard({
                      ...editingBoard,
                      boardType: e.target.value as "client" | "internal",
                      isBillable: e.target.value === "client" ? editingBoard.isBillable : false,
                    });
                  }}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-orange-400"
                >
                  <option value="client">Client Board (Billable)</option>
                  <option value="internal">Internal Board (Non-billable)</option>
                </select>
                <p className="mt-1 text-xs text-white/40">
                  {editingBoard.boardType === "internal" 
                    ? "Internal boards track company-internal work without billing" 
                    : "Client boards track billable work for external clients"}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Time Estimate (hours) <span className="text-orange-500">*</span>
                </label>
                <input
                  type="number"
                  value={editingBoard.estimatedHours || ""}
                  onChange={(e) => {
                    setEditingBoard({
                      ...editingBoard,
                      estimatedHours: parseFloat(e.target.value) || 0,
                    });
                    setEditFormErrors({ ...editFormErrors, estimatedHours: "" });
                  }}
                  className={`w-full px-3 py-2 bg-white/10 border rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-orange-400 ${
                    editFormErrors.estimatedHours ? "border-red-500" : "border-white/20"
                  }`}
                  placeholder="40"
                />
                {editFormErrors.estimatedHours && (
                  <p className="mt-1 text-xs text-red-400">{editFormErrors.estimatedHours}</p>
                )}
              </div>

              {editingBoard.boardType === "client" && (
                <div>
                  <label className="flex items-center gap-2 mb-4">
                    <input
                      type="checkbox"
                      checked={editingBoard.isBillable || false}
                      onChange={(e) =>
                        setEditingBoard({
                          ...editingBoard,
                          isBillable: e.target.checked,
                        })
                      }
                      className="rounded border-white/20 bg-white/10 text-orange-500 focus:ring-orange-500"
                    />
                    <span className="text-sm text-white">Billable client</span>
                  </label>
                </div>
              )}

              {editingBoard.boardType === "client" && editingBoard.isBillable && (
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Billing Type
                  </label>
                  <select
                    value={editingBoard.billingType || "hourly"}
                    onChange={(e) =>
                      setEditingBoard({
                        ...editingBoard,
                        billingType: e.target.value as "hourly" | "fixed",
                      })
                    }
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-orange-400"
                  >
                    <option value="hourly">Hourly</option>
                    <option value="fixed">Fixed Price</option>
                  </select>
                </div>
              )}

              {editingBoard.boardType === "client" && editingBoard.isBillable && editingBoard.billingType === "hourly" && (
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Hourly Rate ($) <span className="text-orange-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={editingBoard.hourlyRate || ""}
                    onChange={(e) => {
                      setEditingBoard({
                        ...editingBoard,
                        hourlyRate: parseFloat(e.target.value) || 0,
                      });
                      setEditFormErrors({ ...editFormErrors, hourlyRate: "" });
                    }}
                    className={`w-full px-3 py-2 bg-white/10 border rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-orange-400 ${
                      editFormErrors.hourlyRate ? "border-red-500" : "border-white/20"
                    }`}
                    placeholder="100"
                  />
                  {editFormErrors.hourlyRate && (
                    <p className="mt-1 text-xs text-red-400">{editFormErrors.hourlyRate}</p>
                  )}
                </div>
              )}

              {editingBoard.boardType === "client" && editingBoard.isBillable && editingBoard.billingType === "fixed" && (
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Fixed Price ($) <span className="text-orange-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={editingBoard.fixedPrice || ""}
                    onChange={(e) => {
                      setEditingBoard({
                        ...editingBoard,
                        fixedPrice: parseFloat(e.target.value) || 0,
                      });
                      setEditFormErrors({ ...editFormErrors, fixedPrice: "" });
                    }}
                    className={`w-full px-3 py-2 bg-white/10 border rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-orange-400 ${
                      editFormErrors.fixedPrice ? "border-red-500" : "border-white/20"
                    }`}
                    placeholder="5000"
                  />
                  {editFormErrors.fixedPrice && (
                    <p className="mt-1 text-xs text-red-400">{editFormErrors.fixedPrice}</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white hover:bg-white/20 transition"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                onClick={handleEditBoard}
                disabled={isSaving}
                className="flex-1 px-4 py-2 bg-orange-500 text-black rounded-lg hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Users Modal */}
      {isAssignModalOpen && selectedBoard && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-[#0a0a0a] border border-white/20 rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">
                Assign Users to {selectedBoard.name}
              </h2>
              <button
                onClick={() => setIsAssignModalOpen(false)}
                className="p-1 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto border border-white/20 rounded-lg p-2 mb-6">
              {users.map((user) => (
                <label key={user.id} className="flex items-center gap-2 p-1 hover:bg-white/10 rounded">
                  <input
                    type="checkbox"
                    checked={selectedUsers.includes(user.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedUsers([...selectedUsers, user.id]);
                      } else {
                        setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                      }
                    }}
                    className="rounded border-white/20 bg-white/10 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-sm text-white">
                    {user.full_name || user.email}
                  </span>
                </label>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsAssignModalOpen(false)}
                className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white hover:bg-white/20 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignUsers}
                className="flex-1 px-4 py-2 bg-orange-500 text-black rounded-lg hover:bg-orange-400 transition flex items-center justify-center gap-2"
              >
                <Users className="w-4 h-4" />
                Assign Users
              </button>
            </div>
          </div>
        </div>
      )}
        </main>
      </div>
    </div>
  );
}
