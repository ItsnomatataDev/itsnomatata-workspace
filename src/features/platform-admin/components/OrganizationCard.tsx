import { Building2 } from "lucide-react";
import type { OrganizationRow } from "../types/platformAdmin";
import OrganizationStatusBadge from "./OrganizationStatusBadge";

export default function OrganizationCard({
  organization,
  selected,
  onSelect,
}: {
  organization: OrganizationRow;
  selected?: boolean;
  onSelect: (organization: OrganizationRow) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(organization)}
      className={[
        "w-full rounded-2xl border p-4 text-left transition",
        selected
          ? "border-orange-500 bg-orange-500/10"
          : "border-white/10 bg-[#151515] hover:border-orange-500/40",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-500 text-black">
            <Building2 size={18} />
          </div>

          <div>
            <p className="font-semibold text-white">{organization.name}</p>
            <p className="text-xs text-white/45">{organization.slug}</p>
          </div>
        </div>

        <OrganizationStatusBadge status={organization.access_status} />
      </div>

      {organization.is_system_organization ? (
        <p className="mt-3 inline-flex rounded-full bg-orange-500 px-2 py-1 text-[11px] font-semibold text-black">
          System organization
        </p>
      ) : null}
    </button>
  );
}