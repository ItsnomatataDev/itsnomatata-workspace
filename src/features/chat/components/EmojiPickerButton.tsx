import { useState } from "react";
import { SmilePlus } from "lucide-react";

const EMOJIS = [
  "😀",
  "😂",
  "😍",
  "😎",
  "🥳",
  "🔥",
  "✨",
  "👏",
  "🙏",
  "💪",
  "👍",
  "❤️",
  "✅",
  "👀",
  "💡",
  "🚀",
  "🎯",
  "☕",
  "🍿",
  "😭",
  "😅",
  "🤝",
  "🙌",
  "🧡",
];

export default function EmojiPickerButton({
  disabled,
  onSelect,
}: {
  disabled?: boolean;
  onSelect: (emoji: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
        title="Insert emoji"
        aria-label="Insert emoji"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <SmilePlus size={18} />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Emoji picker"
          className="absolute bottom-full left-0 z-40 mb-3 w-72 rounded-2xl border border-white/10 bg-neutral-950 p-3 shadow-2xl shadow-black/60"
        >
          <div className="grid grid-cols-8 gap-1">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onSelect(emoji);
                  setOpen(false);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-lg transition hover:bg-orange-500/15"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
