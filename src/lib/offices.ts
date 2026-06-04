export const OFFICE_SLUGS = {
  itsNoMatata: "its-no-matata",
  threeLittleBirds: "three-little-birds",
} as const;

export type OfficeSlug = (typeof OFFICE_SLUGS)[keyof typeof OFFICE_SLUGS];

export type CompanyOffice = {
  id: string;
  organization_id: string;
  name: string;
  slug: OfficeSlug | string;
  is_primary: boolean;
  created_at?: string;
};

export const OFFICE_OPTIONS: Array<{ slug: OfficeSlug; name: string }> = [
  { slug: OFFICE_SLUGS.itsNoMatata, name: "IT's No Matata" },
  { slug: OFFICE_SLUGS.threeLittleBirds, name: "Three Little Birds" },
];

export function normalizeOfficeSlug(slug?: string | null): string | null {
  if (!slug) return null;

  const value = slug
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/\s+/g, "-");

  if (
    value === "itsnomatata" ||
    value === "its-nomatata" ||
    value === "its-no-matata" ||
    value === "it-s-no-matata"
  ) {
    return OFFICE_SLUGS.itsNoMatata;
  }

  if (
    value === "three-little-birds" ||
    value === "tlb" ||
    value.includes("little-bird")
  ) {
    return OFFICE_SLUGS.threeLittleBirds;
  }

  return value;
}

export type OfficeCapabilities = {
  slug: string | null;
  isThreeLittleBirds: boolean;
  detailedTimeTracking: boolean;
  aiWorkspace: boolean;
  meetings: boolean;
  timesheetNav: boolean;
  contentStudio: boolean;
};

export function getOfficeCapabilities(
  office?: { slug?: string | null } | string | null,
): OfficeCapabilities {
  const slug =
    typeof office === "string"
      ? normalizeOfficeSlug(office)
      : normalizeOfficeSlug(office?.slug);
  const isThreeLittleBirds = slug === OFFICE_SLUGS.threeLittleBirds;

  return {
    slug,
    isThreeLittleBirds,
    detailedTimeTracking: !isThreeLittleBirds,
    aiWorkspace: !isThreeLittleBirds,
    meetings: !isThreeLittleBirds,
    timesheetNav: !isThreeLittleBirds,
    contentStudio: !isThreeLittleBirds,
  };
}

export function isThreeLittleBirdsOffice(
  office?: { slug?: string | null } | string | null,
) {
  return getOfficeCapabilities(office).isThreeLittleBirds;
}

export function getOfficeName(
  officeId: string | null | undefined,
  offices: CompanyOffice[],
) {
  return offices.find((office) => office.id === officeId)?.name ?? "Office";
}

export function canManageAllOffices(profile?: {
  primary_role?: string | null;
  office?: { is_primary?: boolean | null; slug?: string | null } | null;
} | null) {
  const role = String(profile?.primary_role ?? "");
  const elevated = ["admin", "super_admin", "superadmin", "it-superadmin"].includes(role);
  return elevated && profile?.office?.is_primary === true;
}

export function canUseDetailedTimeTracking(profile?: {
  office?: { slug?: string | null } | null;
} | null) {
  return getOfficeCapabilities(profile?.office).detailedTimeTracking;
}

export function isITsNomatataOfficeProfile(profile?: {
  office?: { slug?: string | null } | null;
} | null) {
  return (
    getOfficeCapabilities(profile?.office).slug === OFFICE_SLUGS.itsNoMatata
  );
}

/** Offices that may use Content Studio (excludes Three Little Birds). */
export function filterContentStudioOffices(offices: CompanyOffice[]) {
  return offices.filter((office) => getOfficeCapabilities(office).contentStudio);
}

export function pickContentStudioOffice(
  offices: CompanyOffice[],
  preferredOfficeId?: string | null,
) {
  const eligible = filterContentStudioOffices(offices);
  if (eligible.length === 0) return null;

  if (preferredOfficeId) {
    const preferred = eligible.find((office) => office.id === preferredOfficeId);
    if (preferred) return preferred;
  }

  return (
    eligible.find((office) => office.is_primary) ??
    eligible.find(
      (office) => normalizeOfficeSlug(office.slug) === OFFICE_SLUGS.itsNoMatata,
    ) ??
    eligible[0]
  );
}

export function describeOfficeCapabilities(
  office?: { slug?: string | null; name?: string | null } | null,
) {
  const capabilities = getOfficeCapabilities(office);
  const officeName = office && "name" in office ? office.name : null;

  if (capabilities.isThreeLittleBirds) {
    return `${officeName ?? "Three Little Birds"}: attendance-focused access. Detailed timesheets, meetings, and AI workspace are hidden.`;
  }

  return `${officeName ?? "IT's No Matata"}: full workspace access including boards, detailed time tracking, meetings, and AI workspace.`;
}
