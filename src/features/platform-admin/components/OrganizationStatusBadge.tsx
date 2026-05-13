import type { OrganizationAccessStatus } from "../types/platformAdmin";

export default function OrganizationStatusBadge({
  status,
}: {
  status: OrganizationAccessStatus;
}) {
  const classes =
    status === "active"
      ? "bg-orange-500 text-black"
      : status === "suspended"
        ? "bg-red-500/15 text-red-300"
        : "bg-white/10 text-white/60";

  return (
    <span
      className={[
        "rounded-full px-2 py-1 text-[11px] font-semibold capitalize",
        classes,
      ].join(" ")}
    >
      {status}
    </span>
  );
}