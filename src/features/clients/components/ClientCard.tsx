import { Building2, Globe, BriefcaseBusiness, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { Client } from "../../../lib/supabase/queries/clients";

export default function ClientCard({ client }: { client: Client }) {
  return (
    <Link
      to={`/clients/${client.id}`}
      className="group rounded-2xl border border-white/10 bg-black/40 p-5 transition hover:border-orange-500/40 hover:bg-black/60"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="rounded-xl bg-orange-500/15 p-3 text-orange-500">
          <Building2 size={18} />
        </div>

        <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase text-white/60">
          {client.status}
        </span>
      </div>

      <h3 className="mt-4 text-lg font-semibold text-white">{client.name}</h3>

      <div className="mt-4 space-y-2 text-sm text-white/60">
        <div className="flex items-center gap-2">
          <BriefcaseBusiness size={15} />
          <span>{client.industry || "No industry"}</span>
        </div>

        <div className="flex items-center gap-2">
          <Globe size={15} />
          <span className="truncate">{client.website_url || "No website"}</span>
        </div>
      </div>

      <p className="mt-4 line-clamp-2 text-sm text-white/55">
        {client.description || "No description yet."}
      </p>

      <div className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-orange-500">
        Open workspace
        <ArrowRight
          size={15}
          className="transition group-hover:translate-x-1"
        />
      </div>
    </Link>
  );
}
