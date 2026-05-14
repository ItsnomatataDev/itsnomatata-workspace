export default function RoleBadge({ role }: { role?: string | null }) {
  return (
    <span className="rounded-full bg-orange-500/10 px-2 py-1 text-xs font-semibold text-orange-200">
      {role || "employee"}
    </span>
  );
}
