type TargetProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  primary_role: string | null;
  department: string | null;
  office_id: string | null;
  leave_days_total?: number | null;
  leave_days_remaining?: number | null;
};

type ResolverContext = {
  organizationId: string;
  userId: string;
};

const PROFILE_SELECT = `
  id,
  email,
  full_name,
  username,
  avatar_url,
  primary_role,
  department,
  office_id,
  leave_days_total,
  leave_days_remaining
`;

function isUuid(value: unknown) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

export function normalizePersonText(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9@\s.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function readString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNestedString(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const direct = readString(payload, key);
    if (direct) return direct;
  }

  for (const nestedKey of [
    "targetUser",
    "target_user",
    "user",
    "employee",
    "assignee",
  ]) {
    const nested = payload[nestedKey];

    if (!nested || typeof nested !== "object" || Array.isArray(nested)) {
      continue;
    }

    const record = nested as Record<string, unknown>;

    for (const key of keys) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
  }

  return null;
}

function readTargetUserId(payload: Record<string, unknown>) {
  for (const key of [
    "userId",
    "user_id",
    "employeeId",
    "employee_id",
    "targetUserId",
    "target_user_id",
    "assigneeId",
    "assignee_id",
  ]) {
    const value = payload[key];
    if (isUuid(value)) return value as string;
  }

  return null;
}

function readTargetEmail(payload: Record<string, unknown>) {
  return readNestedString(payload, [
    "email",
    "userEmail",
    "user_email",
    "employeeEmail",
    "employee_email",
    "targetEmail",
    "target_email",
    "assigneeEmail",
    "assignee_email",
  ]);
}

function readTargetName(payload: Record<string, unknown>) {
  return readNestedString(payload, [
    "name",
    "userName",
    "user_name",
    "employeeName",
    "employee_name",
    "targetName",
    "target_name",
    "assigneeName",
    "assignee_name",
  ]);
}

function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i += 1) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i += 1) {
    for (let j = 1; j <= a.length; j += 1) {
      matrix[i][j] =
        b.charAt(i - 1) === a.charAt(j - 1)
          ? matrix[i - 1][j - 1]
          : Math.min(
              matrix[i - 1][j - 1] + 1,
              matrix[i][j - 1] + 1,
              matrix[i - 1][j] + 1,
            );
    }
  }

  return matrix[b.length][a.length];
}

function similarity(a: string, b: string) {
  const left = normalizePersonText(a);
  const right = normalizePersonText(b);

  if (!left || !right) return 0;
  if (left === right) return 1;

  const distance = levenshtein(left, right);
  const maxLength = Math.max(left.length, right.length, 1);

  return 1 - distance / maxLength;
}

export function personMatchScore(
  profile: Record<string, unknown>,
  query: string,
): number {
  const target = normalizePersonText(query);

  const fullName = normalizePersonText(profile.full_name);
  const email = normalizePersonText(profile.email);
  const username = normalizePersonText(profile.username);

  const haystack = `${fullName} ${email} ${username}`.trim();

  if (!target) return 0;

  if (email === target) return 100;
  if (fullName === target) return 98;
  if (username === target) return 95;

  if (email.includes(target)) return 90;
  if (fullName.includes(target)) return 88;
  if (username.includes(target)) return 84;
  if (haystack.includes(target)) return 80;

  const targetParts = target.split(" ").filter(Boolean);
  const haystackParts = haystack.split(" ").filter(Boolean);

  const partScores = targetParts.map((targetPart) => {
    if (haystackParts.includes(targetPart)) return 1;

    return Math.max(
      ...haystackParts.map((candidatePart) =>
        similarity(targetPart, candidatePart)
      ),
      0,
    );
  });

  const averagePartScore =
    partScores.reduce((sum, value) => sum + value, 0) /
    Math.max(partScores.length, 1);

  const fullNameSimilarity = similarity(target, fullName);
  const usernameSimilarity = similarity(target, username);
  const emailSimilarity = similarity(target, email);

  return Math.round(
    Math.max(
      averagePartScore * 78,
      fullNameSimilarity * 92,
      usernameSimilarity * 86,
      emailSimilarity * 82,
    ),
  );
}

async function getCurrentProfile(
  adminClient: any,
  ctx: ResolverContext,
): Promise<TargetProfile> {
  const { data, error } = await adminClient
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("organization_id", ctx.organizationId)
    .eq("id", ctx.userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("User not found.");

  return data as TargetProfile;
}

export async function resolveTargetProfile(
  adminClient: any,
  ctx: ResolverContext,
  payload: Record<string, unknown>,
): Promise<TargetProfile> {
  const requestedId = readTargetUserId(payload);
  const requestedEmail = readTargetEmail(payload);
  const requestedName = readTargetName(payload);

  if (requestedId) {
    const { data, error } = await adminClient
      .from("profiles")
      .select(PROFILE_SELECT)
      .eq("organization_id", ctx.organizationId)
      .eq("id", requestedId)
      .maybeSingle();

    if (error) throw error;
    if (data) return data as TargetProfile;
  }

  if (requestedEmail) {
    const email = requestedEmail.trim();

    const { data, error } = await adminClient
      .from("profiles")
      .select(PROFILE_SELECT)
      .eq("organization_id", ctx.organizationId)
      .ilike("email", email)
      .maybeSingle();

    if (error) throw error;
    if (data) return data as TargetProfile;
  }

  if (requestedName) {
    const { data, error } = await adminClient
      .from("profiles")
      .select(PROFILE_SELECT)
      .eq("organization_id", ctx.organizationId)
      .limit(500);

    if (error) throw error;

    const ranked = ((data ?? []) as TargetProfile[])
      .map((profile) => ({
        profile,
        score: personMatchScore(profile, requestedName),
      }))
      .filter((item) => item.score >= 45)
      .sort((a, b) => b.score - a.score);

    if (ranked.length === 0) {
      throw new Error(
        `I could not find anyone matching "${requestedName}" in this organization.`,
      );
    }

    if (ranked.length === 1 || ranked[0].score >= ranked[1].score + 8) {
      return ranked[0].profile;
    }

    throw new Error(
      `I found multiple similar people: ${ranked
        .slice(0, 5)
        .map(
          (item) =>
            `${item.profile.full_name ?? item.profile.email ?? "Unknown user"}`,
        )
        .join(", ")}. Please use their email address.`,
    );
  }

  return getCurrentProfile(adminClient, ctx);
}