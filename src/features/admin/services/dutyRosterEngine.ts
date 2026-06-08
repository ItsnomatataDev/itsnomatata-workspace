import type {
  DutyAssignmentHistoryRow,
  DutyAssignmentPreview,
  DutyCategory,
  DutyDefinitionRow,
  DutyEligibilityOverrideRow,
} from "./dutyRosterTypes";

export type DutyRosterEngineRoster = {
  id: string;
  week_start: string;
};

export type DutyRosterEngineMember = {
  user_id: string;
  sort_order: number;
};

export type DutyRosterEngineRosterDuty = {
  duty_id: string;
  sort_order: number;
  assigned_user_id: string | null;
};

export type DutyRosterEngineUser = {
  id: string;
  full_name: string | null;
  email: string | null;
  primary_role: string | null;
};

const MANAGER_ROLES = new Set(["manager", "hr"]);
const BOSS_ROLES = new Set([
  "admin",
  "superadmin",
  "super_admin",
  "org_admin",
  "it-superadmin",
]);

const CATEGORY_LABELS: Record<DutyCategory, string> = {
  normal_rotation: "Rotates weekly",
  fixed_person: "Fixed person",
  friday_rotation: "Single day rotation",
  custom_rotation: "Custom rotation",
};

export const DUTY_TYPE_OPTIONS: Array<{
  value: DutyCategory;
  label: string;
  description: string;
}> = [
  {
    value: "normal_rotation",
    label: "Rotates Weekly",
    description: "Assigns a different participant each week.",
  },
  {
    value: "fixed_person",
    label: "Fixed Person",
    description: "One permanent owner for this duty.",
  },
  {
    value: "friday_rotation",
    label: "Single Day Rotation",
    description: "Rotates on a specific day each week.",
  },
  {
    value: "custom_rotation",
    label: "Custom Rotation",
    description: "Rotates on a chosen weekday with custom rules.",
  },
];

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dayOfWeekToDate(weekStart: string, dayOfWeek: number | null) {
  if (!dayOfWeek) return null;
  return addDays(weekStart, dayOfWeek - 1);
}

function isManagerRole(role: string | null | undefined) {
  return MANAGER_ROLES.has(String(role ?? ""));
}

function isBossRole(role: string | null | undefined) {
  return BOSS_ROLES.has(String(role ?? ""));
}

function isDateWithinRange(
  weekStart: string,
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
) {
  if (startsAt && weekStart < startsAt) return false;
  if (endsAt && weekStart > endsAt) return false;
  return true;
}

export function getDutyCategoryLabel(category: DutyCategory) {
  return CATEGORY_LABELS[category] ?? category;
}

function getActiveFixedOwnerDuties(
  duties: DutyDefinitionRow[],
  weekStart: string,
) {
  const owners = new Map<string, DutyDefinitionRow[]>();

  for (const duty of duties) {
    if (duty.category !== "fixed_person" || !duty.is_active || !duty.fixed_user_id) {
      continue;
    }
    if (!isDateWithinRange(weekStart, duty.fixed_starts_at, duty.fixed_ends_at)) {
      continue;
    }

    const current = owners.get(duty.fixed_user_id) ?? [];
    current.push(duty);
    owners.set(duty.fixed_user_id, current);
  }

  return owners;
}

export function isFixedDutyOwner(userId: string, duties: DutyDefinitionRow[], weekStart: string) {
  return getActiveFixedOwnerDuties(duties, weekStart).has(userId);
}

export function shouldExcludeFixedOwnerFromDuty(params: {
  userId: string;
  targetDuty: DutyDefinitionRow;
  allDuties: DutyDefinitionRow[];
  weekStart: string;
}) {
  const fixedOwnerDuties = getActiveFixedOwnerDuties(params.allDuties, params.weekStart);
  const ownedDuties = fixedOwnerDuties.get(params.userId);
  if (!ownedDuties || ownedDuties.length === 0) return false;

  if (
    params.targetDuty.category === "fixed_person" &&
    ownedDuties.some((duty) => duty.id === params.targetDuty.id)
  ) {
    return false;
  }

  if (params.targetDuty.category === "friday_rotation") {
    return !ownedDuties.some(
      (duty) => duty.fixed_duty_participates_in_friday_rotation !== false,
    );
  }

  if (
    params.targetDuty.category === "normal_rotation" ||
    params.targetDuty.category === "custom_rotation"
  ) {
    return true;
  }

  return false;
}

export function buildEligiblePool(params: {
  users: DutyRosterEngineUser[];
  rosterMembers: DutyRosterEngineMember[];
  duty: DutyDefinitionRow;
  overrides: DutyEligibilityOverrideRow[];
  allDuties?: DutyDefinitionRow[];
  weekStart?: string;
}): DutyRosterEngineUser[] {
  const rosterMemberIds = new Set(params.rosterMembers.map((item) => item.user_id));
  const overrideMap = new Map(
    params.overrides.map((item) => [item.user_id, item]),
  );
  const includedRoles = new Set(params.duty.included_roles ?? []);
  const excludedRoles = new Set(params.duty.excluded_roles ?? []);
  const hasRoleInclusion = includedRoles.size > 0;
  const allDuties = params.allDuties ?? [params.duty];
  const weekStart = params.weekStart ?? new Date().toISOString().slice(0, 10);

  return params.users.filter((user) => {
    const override = overrideMap.get(user.id);
    if (override?.is_excluded) return false;
    if (override?.is_forced_included) return true;

    if (
      shouldExcludeFixedOwnerFromDuty({
        userId: user.id,
        targetDuty: params.duty,
        allDuties,
        weekStart,
      })
    ) {
      return false;
    }

    if (
      params.duty.category === "fixed_person" &&
      params.duty.fixed_user_id === user.id
    ) {
      return true;
    }

    if (!rosterMemberIds.has(user.id)) {
      return false;
    }

    const role = String(user.primary_role ?? "");
    if (hasRoleInclusion && !includedRoles.has(role)) return false;
    if (excludedRoles.has(role)) return false;
    if (!params.duty.allow_managers && isManagerRole(role)) return false;
    if (!params.duty.allow_bosses && isBossRole(role)) return false;

    return true;
  });
}

function getLastAssignmentWeek(
  history: DutyAssignmentHistoryRow[],
  dutyId: string,
  userId: string,
) {
  const matches = history
    .filter((item) => item.duty_id === dutyId && item.user_id === userId)
    .sort((a, b) => b.assignment_week.localeCompare(a.assignment_week));
  return matches[0]?.assignment_week ?? null;
}

function getLastCategoryAssignmentWeek(
  history: DutyAssignmentHistoryRow[],
  userId: string,
  categories: DutyCategory[],
  dutyMap: Map<string, DutyDefinitionRow>,
) {
  const matches = history
    .filter((item) => {
      if (item.user_id !== userId) return false;
      const duty = dutyMap.get(item.duty_id);
      return duty ? categories.includes(duty.category) : false;
    })
    .sort((a, b) => b.assignment_week.localeCompare(a.assignment_week));
  return matches[0]?.assignment_week ?? null;
}

function countAssignmentsForUser(
  history: DutyAssignmentHistoryRow[],
  userId: string,
  categories: DutyCategory[],
  dutyMap: Map<string, DutyDefinitionRow>,
) {
  return history.filter((item) => {
    if (item.user_id !== userId) return false;
    const duty = dutyMap.get(item.duty_id);
    return duty ? categories.includes(duty.category) : false;
  }).length;
}

function pickFairAssignee(params: {
  duty: DutyDefinitionRow;
  eligibleUsers: DutyRosterEngineUser[];
  history: DutyAssignmentHistoryRow[];
  weekStart: string;
  alreadyAssignedThisWeek: Set<string>;
  preferSeparateTrack: boolean;
  dutyMap: Map<string, DutyDefinitionRow>;
  manualOverride?: string | null;
}) {
  if (params.manualOverride) {
    const manualUser = params.eligibleUsers.find(
      (user) => user.id === params.manualOverride,
    );
    if (manualUser) return manualUser.id;
  }

  if (params.eligibleUsers.length === 0) return "";

  const relevantHistory = params.preferSeparateTrack
    ? params.history
    : params.history.filter((item) => {
        const duty = params.dutyMap.get(item.duty_id);
        return duty?.category === params.duty.category;
      });

  const ranked = [...params.eligibleUsers].sort((a, b) => {
    const useGlobalNormalFairness = params.duty.category === "normal_rotation";
    const aLast = useGlobalNormalFairness
      ? getLastCategoryAssignmentWeek(
          relevantHistory,
          a.id,
          ["normal_rotation"],
          params.dutyMap,
        )
      : getLastAssignmentWeek(relevantHistory, params.duty.id, a.id);
    const bLast = useGlobalNormalFairness
      ? getLastCategoryAssignmentWeek(
          relevantHistory,
          b.id,
          ["normal_rotation"],
          params.dutyMap,
        )
      : getLastAssignmentWeek(relevantHistory, params.duty.id, b.id);

    if (!aLast && bLast) return -1;
    if (aLast && !bLast) return 1;
    if (aLast && bLast && aLast !== bLast) {
      return aLast.localeCompare(bLast);
    }

    const aCount = countAssignmentsForUser(
      relevantHistory,
      a.id,
      useGlobalNormalFairness ? ["normal_rotation"] : [params.duty.category],
      params.dutyMap,
    );
    const bCount = countAssignmentsForUser(
      relevantHistory,
      b.id,
      useGlobalNormalFairness ? ["normal_rotation"] : [params.duty.category],
      params.dutyMap,
    );
    if (aCount !== bCount) return aCount - bCount;

    const aBusy = params.alreadyAssignedThisWeek.has(a.id) ? 1 : 0;
    const bBusy = params.alreadyAssignedThisWeek.has(b.id) ? 1 : 0;
    if (aBusy !== bBusy) return aBusy - bBusy;

    return (a.full_name || a.email || a.id).localeCompare(
      b.full_name || b.email || b.id,
    );
  });

  const unassigned = ranked.find(
    (user) => !params.alreadyAssignedThisWeek.has(user.id),
  );
  return (unassigned ?? ranked[0]).id;
}

function shouldAssignDutyThisWeek(duty: DutyDefinitionRow, weekStart: string) {
  if (duty.category === "friday_rotation") return true;
  if (duty.category === "custom_rotation" && duty.day_of_week) {
    return Boolean(dayOfWeekToDate(weekStart, duty.day_of_week));
  }
  if (duty.category === "fixed_person") return true;
  return duty.category === "normal_rotation";
}

function resolveFixedAssignee(
  duty: DutyDefinitionRow,
  weekStart: string,
  eligibleUsers: DutyRosterEngineUser[],
) {
  if (!duty.fixed_user_id) return "";
  if (!isDateWithinRange(weekStart, duty.fixed_starts_at, duty.fixed_ends_at)) {
    return "";
  }
  const fixedUser = eligibleUsers.find((user) => user.id === duty.fixed_user_id);
  return fixedUser?.id ?? duty.fixed_user_id;
}

export function generateDutyAssignments(params: {
  roster: DutyRosterEngineRoster;
  weekStart: string;
  rosterMembers: DutyRosterEngineMember[];
  rosterDuties: DutyRosterEngineRosterDuty[];
  duties: DutyDefinitionRow[];
  users: DutyRosterEngineUser[];
  overridesByDuty: Map<string, DutyEligibilityOverrideRow[]>;
  history: DutyAssignmentHistoryRow[];
  existingWeekHistory?: DutyAssignmentHistoryRow[];
  manualOverrides?: Map<string, string | null>;
}): DutyAssignmentPreview[] {
  const dutyMap = new Map(params.duties.map((duty) => [duty.id, duty]));
  const rosterDuties = [...params.rosterDuties].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  const existingByDuty = new Map(
    (params.existingWeekHistory ?? []).map((item) => [item.duty_id, item]),
  );
  const historyBeforeWeek = params.history.filter(
    (item) => item.assignment_week < params.weekStart,
  );
  const normalAssignedThisWeek = new Set<string>();
  const assignments: DutyAssignmentPreview[] = [];

  for (const rosterDuty of rosterDuties) {
    const duty = dutyMap.get(rosterDuty.duty_id);
    if (!duty || !duty.is_active) continue;
    if (!shouldAssignDutyThisWeek(duty, params.weekStart)) continue;

    const existing = existingByDuty.get(duty.id);
    if (existing) {
      if (duty.category === "normal_rotation") {
        normalAssignedThisWeek.add(existing.user_id);
      }
      assignments.push({
        id: `${params.roster.id}:${params.weekStart}:${duty.id}`,
        roster_id: params.roster.id,
        duty_id: duty.id,
        duty_name: duty.name,
        description: duty.description,
        duty_type: duty.duty_type,
        duty_category: duty.category,
        day_of_week: duty.day_of_week,
        shift_date:
          duty.category === "friday_rotation"
            ? dayOfWeekToDate(params.weekStart, duty.day_of_week ?? 5)
            : duty.day_of_week
              ? dayOfWeekToDate(params.weekStart, duty.day_of_week)
              : null,
        week_start: params.weekStart,
        user_id: existing.user_id,
        source: existing.source,
        eligible_count: buildEligiblePool({
          users: params.users,
          rosterMembers: params.rosterMembers,
          duty,
          overrides: params.overridesByDuty.get(duty.id) ?? [],
          allDuties: params.duties,
          weekStart: params.weekStart,
        }).length,
        rotation_status:
          existing.source === "manual"
            ? "Manual override"
            : existing.source === "fixed"
              ? "Fixed assignment"
              : "From history",
        is_special_day: duty.category === "friday_rotation",
      });
      continue;
    }

    const eligibleUsers = buildEligiblePool({
      users: params.users,
      rosterMembers: params.rosterMembers,
      duty,
      overrides: params.overridesByDuty.get(duty.id) ?? [],
      allDuties: params.duties,
      weekStart: params.weekStart,
    });

    const useBaselineOverride =
      params.weekStart === params.roster.week_start &&
      historyBeforeWeek.length === 0;
    const manualOverride = params.manualOverrides?.get(duty.id)
      ?? (useBaselineOverride ? rosterDuty.assigned_user_id : null);

    let userId = "";
    let source: DutyAssignmentPreview["source"] = "generated";
    let rotationStatus = "Generated";

    if (duty.category === "fixed_person") {
      userId = resolveFixedAssignee(duty, params.weekStart, eligibleUsers);
      source = "fixed";
      rotationStatus = "Fixed owner";
    } else {
      userId = pickFairAssignee({
        duty,
        eligibleUsers,
        history: historyBeforeWeek,
        weekStart: params.weekStart,
        alreadyAssignedThisWeek: normalAssignedThisWeek,
        preferSeparateTrack:
          duty.category === "friday_rotation" ||
          duty.category === "custom_rotation",
        dutyMap,
        manualOverride,
      });
      if (manualOverride && userId === manualOverride) {
        source = "manual";
        rotationStatus = "Manual baseline";
      } else {
        rotationStatus = "Fair rotation";
      }
    }

    if (!userId) continue;

    if (duty.category === "normal_rotation") {
      normalAssignedThisWeek.add(userId);
    }

    assignments.push({
      id: `${params.roster.id}:${params.weekStart}:${duty.id}`,
      roster_id: params.roster.id,
      duty_id: duty.id,
      duty_name: duty.name,
      description: duty.description,
      duty_type: duty.duty_type,
      duty_category: duty.category,
      day_of_week: duty.day_of_week,
      shift_date:
        duty.category === "friday_rotation"
          ? dayOfWeekToDate(params.weekStart, duty.day_of_week ?? 5)
          : duty.day_of_week
            ? dayOfWeekToDate(params.weekStart, duty.day_of_week)
            : null,
      week_start: params.weekStart,
      user_id: userId,
      source,
      eligible_count: eligibleUsers.length,
      rotation_status: rotationStatus,
      is_special_day: duty.category === "friday_rotation",
    });
  }

  return assignments;
}

export function getExcludedUsersForDuty(params: {
  users: DutyRosterEngineUser[];
  rosterMembers: DutyRosterEngineMember[];
  duty: DutyDefinitionRow;
  overrides: DutyEligibilityOverrideRow[];
  allDuties?: DutyDefinitionRow[];
  weekStart?: string;
}) {
  const eligibleIds = new Set(
    buildEligiblePool({
      users: params.users,
      rosterMembers: params.rosterMembers,
      duty: params.duty,
      overrides: params.overrides,
      allDuties: params.allDuties,
      weekStart: params.weekStart,
    }).map((user) => user.id),
  );

  return params.users.filter((user) => !eligibleIds.has(user.id));
}

export function previewNextRotationAssignee(params: {
  duty: DutyDefinitionRow;
  roster: DutyRosterEngineRoster;
  weekStart: string;
  rosterMembers: DutyRosterEngineMember[];
  users: DutyRosterEngineUser[];
  overrides: DutyEligibilityOverrideRow[];
  history: DutyAssignmentHistoryRow[];
  rosterDuties: DutyRosterEngineRosterDuty[];
  duties: DutyDefinitionRow[];
}) {
  const nextWeek = addDays(params.weekStart, 7);
  const rosterDuty = params.rosterDuties.find(
    (item) => item.duty_id === params.duty.id,
  );
  if (!rosterDuty) return null;

  const generated = generateDutyAssignments({
    roster: params.roster,
    weekStart: nextWeek,
    rosterMembers: params.rosterMembers,
    rosterDuties: [rosterDuty],
    duties: params.duties,
    users: params.users,
    overridesByDuty: new Map([[params.duty.id, params.overrides]]),
    history: params.history,
  });

  return generated[0]?.user_id ?? null;
}
