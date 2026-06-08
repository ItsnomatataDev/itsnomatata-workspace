export type DutyType = "weekly_rotating" | "single_day";

export type DutyCategory =
  | "normal_rotation"
  | "fixed_person"
  | "friday_rotation"
  | "custom_rotation";

export type DutyFrequency =
  | "weekly"
  | "weekly_friday"
  | "weekly_day"
  | "permanent";

export type DutyAssignmentSource =
  | "generated"
  | "manual"
  | "fixed"
  | "regenerated";

export type DutyDefinitionRow = {
  id: string;
  organization_id: string;
  office_id: string | null;
  name: string;
  description: string | null;
  duty_type: DutyType;
  category: DutyCategory;
  frequency: DutyFrequency;
  day_of_week: number | null;
  is_active: boolean;
  allow_managers: boolean;
  allow_bosses: boolean;
  fixed_user_id: string | null;
  fixed_starts_at: string | null;
  fixed_ends_at: string | null;
  fixed_duty_participates_in_friday_rotation: boolean;
  included_roles: string[];
  excluded_roles: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type DutyEligibilityOverrideRow = {
  id: string;
  duty_id: string;
  user_id: string;
  is_excluded: boolean;
  is_forced_included: boolean;
  reason: string | null;
  created_at: string;
};

export type DutyAssignmentHistoryRow = {
  id: string;
  organization_id: string;
  office_id: string | null;
  roster_id: string;
  duty_id: string;
  user_id: string;
  assignment_week: string;
  assignment_date: string | null;
  source: DutyAssignmentSource;
  created_at: string;
};

export type DutyAssignmentPreview = {
  id: string;
  roster_id: string;
  duty_id: string;
  duty_name: string;
  description: string | null;
  duty_type: DutyType;
  duty_category: DutyCategory;
  day_of_week: number | null;
  shift_date: string | null;
  week_start: string;
  user_id: string;
  source: DutyAssignmentSource;
  eligible_count: number;
  rotation_status: string;
  is_special_day: boolean;
  /** @deprecated use is_special_day */
  is_fat_friday?: boolean;
};
