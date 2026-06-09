export type ProfileDisplayPerson = {
  username?: string | null;
  full_name?: string | null;
  email?: string | null;
};

export function getProfileDisplayName(
  person?: ProfileDisplayPerson | null,
  fallback = "Team member",
) {
  return (
    person?.username?.trim() ||
    person?.full_name?.trim() ||
    person?.email?.trim() ||
    fallback
  );
}

export function withProfileDisplayName<T extends ProfileDisplayPerson>(
  person: T,
): T {
  return {
    ...person,
    full_name: getProfileDisplayName(person, person.full_name ?? "Team member"),
  };
}
