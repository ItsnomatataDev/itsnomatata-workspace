export type MessageContentSegment =
  | { kind: "text"; text: string }
  | { kind: "url"; text: string; href: string }
  | { kind: "email"; text: string; href: string };

type ContentMatch = {
  start: number;
  end: number;
  kind: "url" | "email";
  text: string;
  href: string;
};

const HTTP_URL_REGEX = /https?:\/\/[^\s<>'")\]]+/gi;
const WWW_URL_REGEX = /\bwww\.[^\s<>'")\]]+/gi;
const EMAIL_REGEX =
  /\b[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+\b/gi;

function trimTrailingPunctuation(value: string) {
  let text = value;
  let trailing = "";
  while (text.length > 0 && /[.,!?):;\]]/.test(text.at(-1) ?? "")) {
    trailing = `${text.at(-1)}${trailing}`;
    text = text.slice(0, -1);
  }
  return { core: text, trailing };
}

function collectMatches(input: string, regex: RegExp, kind: "url" | "email") {
  const matches: ContentMatch[] = [];
  for (const match of input.matchAll(regex)) {
    const index = match.index;
    if (index === undefined) continue;

    const raw = match[0];
    if (kind === "email") {
      matches.push({
        start: index,
        end: index + raw.length,
        kind,
        text: raw,
        href: `mailto:${raw}`,
      });
      continue;
    }

    const { core } = trimTrailingPunctuation(raw);
    if (!core) continue;
    const href = core.startsWith("www.") ? `https://${core}` : core;
    matches.push({
      start: index,
      end: index + core.length,
      kind,
      text: core,
      href,
    });
  }
  return matches;
}

function mergeNonOverlapping(matches: ContentMatch[]) {
  const sorted = [...matches].sort((a, b) => a.start - b.start || b.end - a.end);
  const merged: ContentMatch[] = [];
  let cursor = 0;

  for (const match of sorted) {
    if (match.start < cursor) continue;
    merged.push(match);
    cursor = match.end;
  }

  return merged;
}

/** Split message text into plain text, URLs, and email segments. */
export function parseMessageContent(input: string): MessageContentSegment[] {
  if (!input) return [];

  const urlMatches = [
    ...collectMatches(input, HTTP_URL_REGEX, "url"),
    ...collectMatches(input, WWW_URL_REGEX, "url"),
  ];
  const emailMatches = collectMatches(input, EMAIL_REGEX, "email");
  const merged = mergeNonOverlapping([...urlMatches, ...emailMatches]);

  if (merged.length === 0) {
    return [{ kind: "text", text: input }];
  }

  const segments: MessageContentSegment[] = [];
  let cursor = 0;

  for (const match of merged) {
    if (match.start > cursor) {
      segments.push({ kind: "text", text: input.slice(cursor, match.start) });
    }
    segments.push({
      kind: match.kind,
      text: match.text,
      href: match.href,
    });
    cursor = match.end;
  }

  if (cursor < input.length) {
    segments.push({ kind: "text", text: input.slice(cursor) });
  }

  return segments;
}

/** Short label for conversation list when the body is only a link or email. */
export function formatMessagePreview(body: string | null | undefined) {
  const trimmed = body?.trim() ?? "";
  if (!trimmed) return "Sent a message";

  const segments = parseMessageContent(trimmed);
  const meaningful = segments.filter(
    (segment) => segment.kind !== "text" || segment.text.trim().length > 0,
  );

  if (meaningful.length === 1) {
    if (meaningful[0].kind === "url") return "Link";
    if (meaningful[0].kind === "email") return "Email";
  }

  return trimmed;
}

export function isPlainTextOnly(body: string) {
  return parseMessageContent(body).every((segment) => segment.kind === "text");
}
