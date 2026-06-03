export type ContentStudioEditorLocationState = {
  suggestedCaption?: string;
  /** 0-based post index inside the schedule (Post 1 = 0). */
  displaySlot?: number;
};

export function parseContentStudioEditorLocationState(
  state: unknown,
): ContentStudioEditorLocationState {
  if (!state || typeof state !== "object") return {};
  const raw = state as Record<string, unknown>;
  const suggestedCaption =
    typeof raw.suggestedCaption === "string" ? raw.suggestedCaption : undefined;
  const displaySlot =
    typeof raw.displaySlot === "number" &&
    Number.isInteger(raw.displaySlot) &&
    raw.displaySlot >= 0 &&
    raw.displaySlot < 10
      ? raw.displaySlot
      : undefined;
  return { suggestedCaption, displaySlot };
}
