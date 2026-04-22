import React from "react";
import { X, Trash2, AlertTriangle } from "lucide-react";
import type { Client } from "../../../lib/supabase/queries/clients";
import { deleteBoard } from "../services/boardService";

interface DeleteBoardModalProps {
  isOpen: boolean;
  board: Client | null;
  organizationId: string;
  onClose: () => void;
  onDelete: () => void;
}

export default function DeleteBoardModal({
  isOpen,
  board,
  organizationId,
  onClose,
  onDelete,
}: DeleteBoardModalProps) {
  if (!isOpen || !board) return null;

  const handleDelete = async () => {
    try {
      await deleteBoard(organizationId, board.id);
      onDelete();
      onClose();
    } catch (err) {
      alert(`Delete failed: ${(err as Error).message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f0f0f] shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center">
              <Trash2 size={20} className="text-red-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Delete Board</h2>
              <p className="text-sm text-white/60">Permanent action</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/10 transition"
          >
            <X size={20} className="text-white/60" />
          </button>
        </div>

        <div className="p-6">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle
              size={20}
              className="text-orange-400 mt-0.5 shrink-0"
            />
            <div>
              <h3 className="font-semibold text-white mb-1">
                "{board.name}" will be deleted
              </h3>
              <p className="text-sm text-white/60">
                All tasks in this board will lose their client assignment
                (client_id set to null). This cannot be undone. Are you sure?
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-white/20 rounded-xl text-white hover:bg-white/5 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="flex-1 px-4 py-3 bg-red-500 text-black rounded-xl font-semibold hover:bg-red-600 transition"
            >
              Delete Board
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
