import { useState } from "react";
import { CalendarDays, Phone, Video, X } from "lucide-react";
import type { MeetingType } from "../types/meeting";

export default function CreateMeetingModal({
  open,
  busy,
  onClose,
  onCreate,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onCreate: (values: {
    title: string;
    description: string;
    meetingType: MeetingType;
    scheduledFor: string | null;
  }) => Promise<void> | void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [meetingType, setMeetingType] = useState<MeetingType>("video");
  const [scheduledFor, setScheduledFor] = useState("");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl border border-white/10 bg-black shadow-[0_20px_80px_rgba(0,0,0,0.65)]">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-7 py-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-orange-400/80">
              Meetings
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white">
              Create a meeting
            </h2>
            <p className="mt-2 max-w-xl text-sm text-white/50">
              Launch an instant session or schedule a professional audio or
              video meeting for your team.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 p-2 text-white/60 transition hover:border-orange-500/30 hover:bg-orange-500/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <form
          className="space-y-6 px-7 py-7"
          onSubmit={async (event) => {
            event.preventDefault();

            await onCreate({
              title,
              description,
              meetingType,
              scheduledFor: scheduledFor || null,
            });

            setTitle("");
            setDescription("");
            setMeetingType("video");
            setScheduledFor("");
          }}
        >
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-white">
                  Meeting title
                </label>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                  placeholder="Weekly strategy sync"
                  className="w-full rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-orange-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-white">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={6}
                  placeholder="Add agenda, discussion topics, or context..."
                  className="w-full resize-none rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-orange-500"
                />
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-white">
                  Meeting type
                </label>

                <div className="grid gap-3">
                  <button
                    type="button"
                    onClick={() => setMeetingType("video")}
                    className={[
                      "rounded-2xl border p-4 text-left transition",
                      meetingType === "video"
                        ? "border-orange-500 bg-orange-500/10"
                        : "border-white/10 bg-neutral-950 hover:border-orange-500/25 hover:bg-orange-500/5",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-orange-500/10 p-2 text-orange-400">
                        <Video size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">
                          Video meeting
                        </p>
                        <p className="mt-1 text-xs text-white/45">
                          Camera and voice enabled
                        </p>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMeetingType("audio")}
                    className={[
                      "rounded-2xl border p-4 text-left transition",
                      meetingType === "audio"
                        ? "border-orange-500 bg-orange-500/10"
                        : "border-white/10 bg-neutral-950 hover:border-orange-500/25 hover:bg-orange-500/5",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-orange-500/10 p-2 text-orange-400">
                        <Phone size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">
                          Audio meeting
                        </p>
                        <p className="mt-1 text-xs text-white/45">
                          Voice only session
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-white">
                  Schedule
                </label>
                <div className="rounded-2xl border border-white/10 bg-neutral-950 p-4">
                  <div className="mb-3 flex items-center gap-2 text-white/45">
                    <CalendarDays size={16} />
                    <span className="text-xs uppercase tracking-[0.2em]">
                      Optional
                    </span>
                  </div>

                  <input
                    type="datetime-local"
                    value={scheduledFor}
                    onChange={(event) => setScheduledFor(event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black px-3 py-2.5 text-sm text-white outline-none focus:border-orange-500"
                  />

                  <p className="mt-3 text-xs text-white/35">
                    Leave empty to start the meeting immediately.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-orange-500/15 bg-orange-500/5 p-4">
                <p className="text-sm font-semibold text-white">Quick note</p>
                <p className="mt-2 text-xs leading-6 text-white/45">
                  Instant meetings begin live immediately. Scheduled meetings
                  stay visible in the meetings dashboard until started.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-6 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-medium text-white/70 transition hover:border-white/20 hover:bg-white/5 hover:text-white"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={busy || !title.trim()}
              className="rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Creating..." : "Create meeting"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
