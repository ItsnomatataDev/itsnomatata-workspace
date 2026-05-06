import type { ChatMessageReaction } from "../types/chat";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "🔥", "👏", "👀"];

type ReactionGroup = {
  emoji: string;
  count: number;
  reactedByMe: boolean;
  names: string[];
};

function groupReactions(
  reactions: ChatMessageReaction[],
  currentUserId?: string,
): ReactionGroup[] {
  const groups = new Map<string, ReactionGroup>();

  for (const reaction of reactions) {
    const current = groups.get(reaction.emoji) ?? {
      emoji: reaction.emoji,
      count: 0,
      reactedByMe: false,
      names: [],
    };

    current.count += 1;
    current.reactedByMe ||= reaction.user_id === currentUserId;
    current.names.push(
      reaction.profile?.full_name ||
        reaction.profile?.email ||
        (reaction.user_id === currentUserId ? "You" : "Someone"),
    );
    groups.set(reaction.emoji, current);
  }

  return Array.from(groups.values()).sort((a, b) =>
    a.emoji.localeCompare(b.emoji),
  );
}

export default function MessageReactions({
  reactions,
  currentUserId,
  disabled,
  onToggle,
}: {
  reactions: ChatMessageReaction[];
  currentUserId?: string;
  disabled?: boolean;
  onToggle: (emoji: string) => void;
}) {
  const grouped = groupReactions(reactions, currentUserId);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {grouped.map((group) => (
        <button
          key={group.emoji}
          type="button"
          disabled={disabled}
          onClick={() => onToggle(group.emoji)}
          title={group.names.join(", ")}
          className={[
            "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs transition disabled:cursor-not-allowed disabled:opacity-60",
            group.reactedByMe
              ? "border-orange-500/40 bg-orange-500/20 text-orange-100"
              : "border-white/10 bg-black/20 text-white/75 hover:border-orange-500/30",
          ].join(" ")}
        >
          <span>{group.emoji}</span>
          <span className="font-semibold">{group.count}</span>
        </button>
      ))}

      <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
        {QUICK_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            disabled={disabled}
            onClick={() => onToggle(emoji)}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-black/30 text-sm transition hover:border-orange-500/40 hover:bg-orange-500/15 disabled:cursor-not-allowed disabled:opacity-60"
            title={`React ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
