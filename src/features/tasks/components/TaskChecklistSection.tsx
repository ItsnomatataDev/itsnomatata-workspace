import { useMemo, useState } from "react";
import { CheckSquare, Plus, Trash2 } from "lucide-react";
import type { TaskChecklistWithItems } from "../../../lib/supabase/queries/taskChecklists";

function getChecklistProgress(checklist: TaskChecklistWithItems) {
  const total = checklist.items.length;
  const completed = checklist.items.filter((item) => item.is_completed).length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  return { total, completed, percent };
}

export default function TaskChecklistSection({
  taskId: _taskId,
  currentUserId: _currentUserId,
  checklists,
  busy,
  onCreateChecklist,
  onDeleteChecklist,
  onAddItem,
  onToggleItem,
  onDeleteItem,
}: {
  taskId: string;
  currentUserId: string;
  checklists: TaskChecklistWithItems[];
  busy?: boolean;
  onCreateChecklist: (title: string) => Promise<void>;
  onDeleteChecklist: (checklistId: string) => Promise<void>;
  onAddItem: (checklistId: string, content: string) => Promise<void>;
  onToggleItem: (itemId: string, checked: boolean) => Promise<void>;
  onDeleteItem: (itemId: string) => Promise<void>;
}) {
  const [newChecklistTitle, setNewChecklistTitle] = useState("");
  const [itemDrafts, setItemDrafts] = useState<Record<string, string>>({});

  const totalSummary = useMemo(() => {
    const total = checklists.reduce(
      (sum, checklist) => sum + checklist.items.length,
      0,
    );
    const completed = checklists.reduce(
      (sum, checklist) =>
        sum + checklist.items.filter((item) => item.is_completed).length,
      0,
    );
    return { total, completed };
  }, [checklists]);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
      <div className="flex items-center gap-2 text-orange-400">
        <CheckSquare size={16} />
        <p className="font-medium">Checklist</p>
      </div>

      <p className="mt-2 text-sm text-white/50">
        {totalSummary.completed}/{totalSummary.total} items completed
      </p>

      <div className="mt-4 flex flex-col gap-3 lg:flex-row">
        <input
          value={newChecklistTitle}
          onChange={(e) => setNewChecklistTitle(e.target.value)}
          placeholder="Add checklist title"
          className="flex-1 rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
        />
        <button
          type="button"
          disabled={busy || !newChecklistTitle.trim()}
          onClick={() => {
            void onCreateChecklist(newChecklistTitle.trim());
            setNewChecklistTitle("");
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 font-semibold text-black disabled:opacity-60"
        >
          <Plus size={16} />
          Add Checklist
        </button>
      </div>

      <div className="mt-5 space-y-4">
        {checklists.length === 0 ? (
          <p className="text-sm text-white/50">
            No checklist yet. Create one for this task.
          </p>
        ) : (
          checklists.map((checklist) => {
            const progress = getChecklistProgress(checklist);

            return (
              <div
                key={checklist.id}
                className="rounded-2xl border border-white/10 bg-black p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate font-semibold text-white">
                      {checklist.title}
                    </h4>
                    <p className="mt-1 text-xs text-white/45">
                      {progress.completed}/{progress.total} completed
                    </p>

                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-orange-500"
                        style={{ width: `${progress.percent}%` }}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => void onDeleteChecklist(checklist.id)}
                    className="rounded-xl border border-red-500/20 bg-red-500/10 p-2 text-red-300"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="mt-4 space-y-2">
                  {checklist.items.length === 0 ? (
                    <p className="text-sm text-white/40">
                      No items yet for this checklist.
                    </p>
                  ) : (
                    checklist.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-zinc-950 px-4 py-3"
                      >
                        <label className="flex min-w-0 flex-1 items-center gap-3">
                          <input
                            type="checkbox"
                            checked={item.is_completed}
                            onChange={(e) =>
                              void onToggleItem(item.id, e.target.checked)
                            }
                            className="h-4 w-4"
                          />
                          <span
                            className={`wrap-break-word text-sm ${
                              item.is_completed
                                ? "text-white/45 line-through"
                                : "text-white"
                            }`}
                          >
                            {item.content}
                          </span>
                        </label>

                        <button
                          type="button"
                          onClick={() => void onDeleteItem(item.id)}
                          className="shrink-0 rounded-xl border border-red-500/20 bg-red-500/10 p-2 text-red-300"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-4 flex flex-col gap-3 lg:flex-row">
                  <input
                    value={itemDrafts[checklist.id] ?? ""}
                    onChange={(e) =>
                      setItemDrafts((prev) => ({
                        ...prev,
                        [checklist.id]: e.target.value,
                      }))
                    }
                    placeholder="Add checklist item, e.g. navbar update"
                    className="flex-1 rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-orange-500"
                  />

                  <button
                    type="button"
                    disabled={!itemDrafts[checklist.id]?.trim()}
                    onClick={() => {
                      const value = itemDrafts[checklist.id]?.trim();
                      if (!value) return;
                      void onAddItem(checklist.id, value);
                      setItemDrafts((prev) => ({
                        ...prev,
                        [checklist.id]: "",
                      }));
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 font-semibold text-black disabled:opacity-60"
                  >
                    <Plus size={16} />
                    Add Item
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
