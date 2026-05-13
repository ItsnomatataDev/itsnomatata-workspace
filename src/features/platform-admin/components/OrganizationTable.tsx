import { Building2 } from "lucide-react";
import type { OrganizationRow } from "../types/platformAdmin";
import OrganizationStatusBadge from "./OrganizationStatusBadge";

export default function OrganizationTable({
  organizations,
  selectedOrg,
  onSelect,
}: {
  organizations: OrganizationRow[];
  selectedOrg: OrganizationRow | null;
  onSelect: (org: OrganizationRow) => void;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-[#111111] p-4 shadow-xl shadow-black/30">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
        <Building2 size={18} className="text-orange-500" />
        Organizations
      </h2>

      <div className="space-y-3">
        {organizations.map((org) => {
          const selected = selectedOrg?.id === org.id;

          return (
            <button
              key={org.id}
              type="button"
              onClick={() => onSelect(org)}
              className={[
                "w-full rounded-2xl border p-4 text-left transition",
                selected
                  ? "border-orange-500 bg-orange-500/10"
                  : "border-white/10 bg-[#151515] hover:border-orange-500/40",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-white">{org.name}</p>
                  <p className="text-xs text-white/45">{org.slug}</p>
                </div>

                <OrganizationStatusBadge status={org.access_status} />
              </div>

              {org.is_system_organization ? (
                <p className="mt-3 inline-flex rounded-full bg-orange-500 px-2 py-1 text-[11px] font-semibold text-black">
                  System organization
                </p>
              ) : null}
            </button>
          );
        })}

        {organizations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-white/45">
            No organizations found.
          </div>
        ) : null}
      </div>
    </section>
  );
}