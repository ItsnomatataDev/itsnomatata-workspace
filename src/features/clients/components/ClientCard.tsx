import { Building2, Globe, Mail, Phone, Briefcase } from "lucide-react";
import type { ClientItem } from "../services/clientService";

export default function ClientCard({
  client,
  onOpenDetails,
  onOpenWorkspace,
}: {
  client: ClientItem;
  onOpenDetails?: (clientId: string) => void;
  onOpenWorkspace?: (clientId: string) => void;
}) {
  return (
    <article className="border border-white/10 bg-[#050505] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-orange-400">
            <Building2 size={16} />
            <p className="text-sm uppercase tracking-[0.2em]">Client</p>
          </div>

          <h3 className="mt-3 truncate text-xl font-bold text-white">
            {client.name}
          </h3>

          {client.industry ? (
            <p className="mt-2 text-sm text-white/45">{client.industry}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 space-y-2 text-sm text-white/65">
        {client.email ? (
          <div className="flex items-center gap-2">
            <Mail size={14} className="text-orange-400" />
            <span>{client.email}</span>
          </div>
        ) : null}

        {client.phone ? (
          <div className="flex items-center gap-2">
            <Phone size={14} className="text-orange-400" />
            <span>{client.phone}</span>
          </div>
        ) : null}

        {client.website ? (
          <div className="flex items-center gap-2">
            <Globe size={14} className="text-orange-400" />
            <span className="truncate">{client.website}</span>
          </div>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {onOpenDetails ? (
          <button
            type="button"
            onClick={() => onOpenDetails(client.id)}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/85"
          >
            Details
          </button>
        ) : null}

        {onOpenWorkspace ? (
          <button
            type="button"
            onClick={() => onOpenWorkspace(client.id)}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-black"
          >
            <Briefcase size={14} />
            Workspace
          </button>
        ) : null}
      </div>
    </article>
  );
}
