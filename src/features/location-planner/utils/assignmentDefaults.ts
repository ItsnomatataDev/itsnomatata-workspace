import {
  DEFAULT_ASSIGNMENT_END_TIME,
  DEFAULT_ASSIGNMENT_START_TIME,
} from "../constants";
import type { AssignmentInput } from "../types";

export function dayAssignmentFields(selectedDate: string) {
  return {
    start_date: selectedDate,
    end_date: selectedDate,
    start_time: DEFAULT_ASSIGNMENT_START_TIME,
    end_time: DEFAULT_ASSIGNMENT_END_TIME,
  };
}

export function normalizeAssignmentInput(
  draft: AssignmentInput,
  selectedDate: string,
): AssignmentInput {
  const date = draft.start_date ?? selectedDate;
  return {
    ...draft,
    start_date: date,
    end_date: date,
    start_time: draft.start_time ?? DEFAULT_ASSIGNMENT_START_TIME,
    end_time: draft.end_time ?? DEFAULT_ASSIGNMENT_END_TIME,
  };
}
