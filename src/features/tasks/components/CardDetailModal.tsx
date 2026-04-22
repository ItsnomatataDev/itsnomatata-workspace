import React, { useState, useEffect } from "react";
import {
  X,
  Clock3,
  Users,
  Tag,
  CheckSquare,
  Paperclip,
  MessageSquare,
  CalendarClock,
  Trash2,
  Edit2,
  Plus,
  Save,
  AlertCircle,
  User,
  Zap,
} from "lucide-react";
import type {
  TaskItem,
  TaskAssigneeItem,
} from "../../../lib/supabase/queries/tasks";

interface CardDetailModalProps {
  cardId: string;
  card: TaskItem & {
    assignees?: TaskAssigneeItem[];
    comments_count?: number;
    tracked_seconds_cache?: number | null;
    is_billable?: boolean;
  };
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: (updates: Partial<TaskItem>) => void;
  onAddComment?: (text: string) => void;
  onToggleTimer?: (cardId: string, title: string) => void;
  hasRunningTimer?: boolean;
}

interface ChecklistItem {
  id: string;
  title: string;
  completed: boolean;
}

interface Comment {
  id: string;
  author: string;
  text: string;
  timestamp: string;
  avatar?: string;
}

interface Label {
  id: string;
  name: string;
  color: string;
}

function formatDuration(seconds?: number | null) {
  const total = Math.max(0, Number(seconds ?? 0));
  if (total === 0) return "0m";
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}

function getInitials(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.trim() || "?";
  const parts = source.split(" ").filter(Boolean);
  return parts.length >= 2
    ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    : source.slice(0, 2).toUpperCase();
}

/**
 * CardDetailModal: Full-featured card detail view (Trello-style)
 * Displays and allows editing all card information
 */
export default function CardDetailModal({
  cardId,
  card,
  isOpen,
  onClose,
  onUpdate,
  onAddComment,
  onToggleTimer,
  hasRunningTimer,
}: CardDetailModalProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(card.title);
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionValue, setDescriptionValue] = useState(
    card.description ?? "",
  );
  const [newComment, setNewComment] = useState("");
  const [checklists, setChecklists] = useState<ChecklistItem[]>([
    { id: "1", title: "Design mockups", completed: true },
    { id: "2", title: "Code implementation", completed: true },
    { id: "3", title: "Testing", completed: false },
  ]);
  const [newChecklistItem, setNewChecklistItem] = useState("");

  const assignees = card.assignees ?? [];
  const labels: Label[] = [
    { id: "1", name: "Dev", color: "#6366f1" },
    { id: "2", name: "Priority", color: "#ef4444" },
  ];

  const comments: Comment[] = [
    {
      author: "Sarah Johnson",
      text: "This is looking good! Just made some adjustments to the design.",
      timestamp: "2 hours ago",
      id: ""
    },
    {
      author: "Mike Chen",
      text: "Ready for testing when you are.",
      timestamp: "1 hour ago",
      id: ""
    },
  ];

  const handleSaveTitle = () => {
    if (titleValue.trim() && titleValue !== card.title) {
      onUpdate?.({ title: titleValue });
    }
    setEditingTitle(false);
    setTitleValue(card.title);
  };

  const handleSaveDescription = () => {
    if (descriptionValue !== card.description) {
      onUpdate?.({ description: descriptionValue });
    }
    setEditingDescription(false);
    setDescriptionValue(card.description ?? "");
  };

  const handleAddComment = () => {
    if (newComment.trim()) {
      onAddComment?.(newComment);
      setNewComment("");
    }
  };

  const handleAddChecklistItem = () => {
    if (newChecklistItem.trim()) {
      setChecklists([
        ...checklists,
        { id: String(Date.now()), title: newChecklistItem, completed: false },
      ]);
      setNewChecklistItem("");
    }
  };

  const toggleChecklistItem = (id: string) => {
    setChecklists(
      checklists.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item,
      ),
    );
  };

  if (!isOpen) return null;

  const checklistProgress = {
    completed: checklists.filter((c) => c.completed).length,
    total: checklists.length,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-[#0f0f0f] border border-white/10 shadow-2xl">

        <div className="sticky top-0 flex items-center justify-between border-b border-white/10 bg-[#1a1a1a]/95 backdrop-blur px-6 py-4 z-10">
          <h2 className="text-xl font-bold text-white truncate flex-1">
            {editingTitle ? (
              <input
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                className="w-full rounded bg-white/10 px-2 py-1 text-white outline-none focus:bg-white/20"
                autoFocus
              />
            ) : (
              <span
                className="flex items-center gap-2 cursor-pointer hover:text-orange-400"
                onClick={() => setEditingTitle(true)}
              >
                {card.title}
                <Edit2 size={16} />
              </span>
            )}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {/* Status Row */}
          <div className="flex flex-wrap items-center gap-4 pb-4 border-b border-white/10">
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wider text-white/50 mb-2">
                Status
              </p>
              <select
                value={card.status}
                onChange={(e) => onUpdate?.({ status: e.target.value as any })}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none hover:border-orange-500/30 focus:border-orange-500/50"
              >
                <option value="backlog">Backlog</option>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="review">Review</option>
                <option value="done">Done</option>
              </select>
            </div>

            <div className="flex-1">
              <p className="text-xs uppercase tracking-wider text-white/50 mb-2">
                Priority
              </p>
              <select
                value={card.priority}
                onChange={(e) =>
                  onUpdate?.({ priority: e.target.value as any })
                }
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none hover:border-orange-500/30 focus:border-orange-500/50"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            {card.is_billable && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                <Zap size={16} className="text-emerald-400" />
                <span className="text-sm font-medium text-emerald-300">
                  Billable
                </span>
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs uppercase tracking-wider text-white/50">
                Description
              </p>
              {!editingDescription && (
                <button
                  onClick={() => setEditingDescription(true)}
                  className="text-xs text-white/50 hover:text-white transition flex items-center gap-1"
                >
                  <Edit2 size={12} />
                  Edit
                </button>
              )}
            </div>

            {editingDescription ? (
              <div className="space-y-2">
                <textarea
                  value={descriptionValue}
                  onChange={(e) => setDescriptionValue(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none resize-none focus:border-orange-500/50 focus:bg-white/10"
                  rows={4}
                  placeholder="Add a detailed description..."
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      setEditingDescription(false);
                      setDescriptionValue(card.description ?? "");
                    }}
                    className="rounded-lg px-3 py-2 text-xs font-medium text-white/60 hover:bg-white/10 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveDescription}
                    className="rounded-lg bg-orange-500 px-3 py-2 text-xs font-medium text-black hover:bg-orange-400 transition"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 min-h-20">
                {descriptionValue || (
                  <span className="text-white/40">No description yet</span>
                )}
              </div>
            )}
          </div>

          {/* Creator & Timeline */}
          <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-black">
                  {getInitials(
                    card.created_by_full_name,
                    card.created_by_email,
                  )}
                </div>
                <div>
                  <p className="font-medium text-white">
                    {card.created_by_full_name ||
                      card.created_by_email ||
                      "Unknown"}
                  </p>
                  <p className="text-xs text-white/50">
                    Created {new Date(card.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Assigned Members */}
            <div>
              <p className="text-xs uppercase tracking-wider text-white/50 mb-2 flex items-center gap-1">
                <Users size={12} />
                Assigned To
              </p>
              <div className="flex flex-wrap gap-2">
                {assignees.length > 0 ? (
                  assignees.slice(0, 3).map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1"
                    >
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-[9px] font-bold text-black">
                        {getInitials(a.full_name, a.email)}
                      </div>
                      <span className="text-xs text-white">
                        {a.full_name || a.email}
                      </span>
                    </div>
                  ))
                ) : (
                  <span className="text-xs text-white/40">No assignments</span>
                )}
              </div>
            </div>

            {/* Due Date */}
            <div>
              <p className="text-xs uppercase tracking-wider text-white/50 mb-2 flex items-center gap-1">
                <CalendarClock size={12} />
                Due Date
              </p>
              <input
                type="date"
                value={card.due_date ? card.due_date.split("T")[0] : ""}
                onChange={(e) =>
                  onUpdate?.({ due_date: e.target.value || null })
                }
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none hover:border-orange-500/30 focus:border-orange-500/50"
              />
            </div>
          </div>

          {/* Time Tracking */}
          <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock3 size={16} className="text-orange-400" />
                <div>
                  <p className="text-xs uppercase tracking-wider text-white/50">
                    Time Tracked
                  </p>
                  <p className="text-2xl font-bold text-white">
                    {formatDuration(card.tracked_seconds_cache)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => onToggleTimer?.(cardId, card.title)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  hasRunningTimer
                    ? "bg-red-500/20 text-red-300 hover:bg-red-500/30"
                    : "bg-orange-500 text-black hover:bg-orange-400"
                }`}
              >
                {hasRunningTimer ? "Stop Timer" : "Start Timer"}
              </button>
            </div>
          </div>

          {/* Checklist Progress */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider text-white/50 flex items-center gap-1">
                <CheckSquare size={12} />
                Checklist ({checklistProgress.completed}/
                {checklistProgress.total})
              </p>
            </div>

            {/* Progress Bar */}
            {checklists.length > 0 && (
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-orange-500 transition-all"
                  style={{
                    width: `${(checklistProgress.completed / checklists.length) * 100}%`,
                  }}
                />
              </div>
            )}

            {/* Checklist Items */}
            <div className="space-y-2">
              {checklists.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2"
                >
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={() => toggleChecklistItem(item.id)}
                    className="h-4 w-4 rounded cursor-pointer accent-orange-500"
                  />
                  <span
                    className={`flex-1 text-sm ${
                      item.completed
                        ? "line-through text-white/40"
                        : "text-white"
                    }`}
                  >
                    {item.title}
                  </span>
                  <button
                    className="text-white/40 hover:text-red-400 transition"
                    onClick={() =>
                      setChecklists(checklists.filter((c) => c.id !== item.id))
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}

              {/* Add New Checklist Item */}
              <div className="flex gap-2">
                <input
                  value={newChecklistItem}
                  onChange={(e) => setNewChecklistItem(e.target.value)}
                  placeholder="Add item..."
                  className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-orange-500/50"
                  onKeyPress={(e) => {
                    if (e.key === "Enter") handleAddChecklistItem();
                  }}
                />
                <button
                  onClick={handleAddChecklistItem}
                  className="rounded-lg bg-orange-500/20 px-3 py-2 text-sm font-medium text-orange-300 hover:bg-orange-500/30 transition"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Labels */}
          <div>
            <p className="text-xs uppercase tracking-wider text-white/50 mb-3 flex items-center gap-1">
              <Tag size={12} />
              Labels
            </p>
            <div className="flex flex-wrap gap-2">
              {labels.map((label) => (
                <button
                  key={label.id}
                  className="rounded-full px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-80"
                  style={{
                    backgroundColor: `${label.color}30`,
                    borderColor: `${label.color}60`,
                    border: "1px solid",
                  }}
                >
                  {label.name}
                </button>
              ))}
              <button className="rounded-full border border-dashed border-white/30 px-3 py-1.5 text-xs font-medium text-white/60 hover:border-orange-500 hover:text-orange-400 transition">
                <Plus size={12} className="inline mr-1" />
                Add
              </button>
            </div>
          </div>

          {/* Attachments */}
          <div>
            <p className="text-xs uppercase tracking-wider text-white/50 mb-3 flex items-center gap-1">
              <Paperclip size={12} />
              Attachments
            </p>
            <button className="w-full rounded-lg border-2 border-dashed border-white/20 px-4 py-6 text-center hover:border-orange-500/50 hover:bg-orange-500/5 transition">
              <Plus size={20} className="mx-auto mb-2 text-white/40" />
              <p className="text-sm text-white/60">
                Click to upload or drag files here
              </p>
            </button>
          </div>

          {/* Comments Section */}
          <div className="border-t border-white/10 pt-6">
            <p className="text-xs uppercase tracking-wider text-white/50 mb-3 flex items-center gap-1">
              <MessageSquare size={12} />
              Activity ({comments.length})
            </p>

            {/* Comment List */}
            <div className="mb-4 space-y-3">
              {comments.map((comment, idx) => (
                <div key={idx} className="rounded-lg bg-white/5 px-4 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white">
                      {getInitials(comment.author, "")}
                    </div>
                    <p className="text-sm font-medium text-white">
                      {comment.author}
                    </p>
                    <span className="text-xs text-white/50">
                      {comment.timestamp}
                    </span>
                  </div>
                  <p className="text-sm text-white/80">{comment.text}</p>
                </div>
              ))}
            </div>

            {/* Add Comment */}
            <div className="space-y-2">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none resize-none focus:border-orange-500/50 focus:bg-white/10"
                rows={2}
              />
              <button
                onClick={handleAddComment}
                disabled={!newComment.trim()}
                className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-black hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Comment
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
