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
