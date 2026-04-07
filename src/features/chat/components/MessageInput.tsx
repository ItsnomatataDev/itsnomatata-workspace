import type { KeyboardEvent } from "react";
import { SendHorizontal } from "lucide-react";

export default function MessageInput({
  value,
  onChange,
  onSend,
  onTyping,
  disabled,
  sending,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onTyping?: () => void;
  disabled: boolean;
  sending: boolean;
}) {
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  };

  return (
    <div className="border-t border-white/10 px-5 py-4">
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            onTyping?.();
          }}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          disabled={disabled || sending}
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-orange-500"
        />
        <button
          type="button"
          onClick={onSend}
          disabled={disabled || !value.trim() || sending}
          className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <SendHorizontal size={16} />
          Send
        </button>
      </div>
    </div>
  );
}
