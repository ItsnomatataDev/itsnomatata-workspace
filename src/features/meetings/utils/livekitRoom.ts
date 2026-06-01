/** Canonical LiveKit room name for a meeting row. */
export function getLivekitRoomName(
  meetingId: string,
  livekitRoomName?: string | null,
): string {
  const trimmed = livekitRoomName?.trim();
  if (trimmed) return trimmed;
  return `meeting:${meetingId}`;
}

export function getMeetingJoinPath(meetingId: string): string {
  return `/meetings/${meetingId}`;
}

export function buildMeetingMeetUrl(
  meetingId: string,
  origin = typeof window !== "undefined" ? window.location.origin : "",
): string | null {
  if (!origin) return null;
  return `${origin.replace(/\/$/, "")}${getMeetingJoinPath(meetingId)}`;
}
