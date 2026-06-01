import { useMemo } from "react";
import { Link2, Mail } from "lucide-react";
import { parseMessageContent } from "../utils/parseMessageContent";

type FormattedMessageBodyProps = {
  text: string;
  /** Bubble colors: outgoing (orange) vs incoming (dark). */
  tone?: "mine" | "theirs";
  className?: string;
};

export default function FormattedMessageBody({
  text,
  tone = "theirs",
  className = "",
}: FormattedMessageBodyProps) {
  const segments = useMemo(() => parseMessageContent(text), [text]);

  const linkClass =
    tone === "mine"
      ? "inline-flex max-w-full items-center gap-1 break-all font-medium text-black underline decoration-black/35 underline-offset-2 hover:decoration-black/60"
      : "inline-flex max-w-full items-center gap-1 break-all font-medium text-sky-300 underline decoration-sky-400/40 underline-offset-2 hover:text-sky-200";

  const emailClass =
    tone === "mine"
      ? "inline-flex max-w-full items-center gap-1 break-all font-medium text-black underline decoration-black/35 underline-offset-2 hover:decoration-black/60"
      : "inline-flex max-w-full items-center gap-1 break-all font-medium text-violet-300 underline decoration-violet-400/40 underline-offset-2 hover:text-violet-200";

  return (
    <p className={`whitespace-pre-wrap wrap-break-word ${className}`.trim()}>
      {segments.map((segment, index) => {
        if (segment.kind === "text") {
          return <span key={index}>{segment.text}</span>;
        }

        if (segment.kind === "email") {
          return (
            <a
              key={index}
              href={segment.href}
              className={emailClass}
              title={`Email ${segment.text}`}
            >
              <Mail size={12} className="shrink-0 opacity-80" aria-hidden />
              {segment.text}
            </a>
          );
        }

        return (
          <a
            key={index}
            href={segment.href}
            target="_blank"
            rel="noreferrer noopener"
            className={linkClass}
            title={segment.href}
          >
            <Link2 size={12} className="shrink-0 opacity-80" aria-hidden />
            {segment.text}
          </a>
        );
      })}
    </p>
  );
}
