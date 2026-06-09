import { User } from "lucide-react";
import { getProfileDisplayName } from "../../lib/utils/profileDisplay";

export type AvatarPerson = {
  full_name?: string | null;
  username?: string | null;
  email?: string | null;
  avatar_url?: string | null;
};

const SIZE_CLASSES = {
  xs: "h-5 w-5",
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-10 w-10",
  xl: "h-16 w-16",
};

const ICON_SIZE = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 28,
};

type UserAvatarProps = {
  person?: AvatarPerson | null;
  src?: string | null;
  alt?: string;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
};

export function getPersonDisplayName(person?: AvatarPerson | null) {
  return getProfileDisplayName(person);
}

export default function UserAvatar({
  person,
  src,
  alt,
  size = "md",
  className = "",
}: UserAvatarProps) {
  const imageUrl = src ?? person?.avatar_url ?? null;
  const label = alt ?? getPersonDisplayName(person);
  const baseClasses = [
    "shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/10 text-white/55",
    SIZE_CLASSES[size],
    className,
  ].join(" ");

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={label}
        title={label}
        className={`${baseClasses} object-cover`}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <span
      className={`${baseClasses} inline-flex items-center justify-center`}
      title={label}
      aria-label={label}
    >
      <User size={ICON_SIZE[size]} />
    </span>
  );
}
