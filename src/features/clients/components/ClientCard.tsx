import {
  ArrowRight,
  Building2,
  Briefcase,
  Globe,
  Mail,
  Phone,
} from "lucide-react";
import type { ClientItem } from "../services/clientService";

export default function ClientCard({
  client,
  metaLabel,
  onOpenDetails,
  onOpenWorkspace,
}: {
  client: ClientItem;
  metaLabel?: string;
  onOpenDetails?: (clientId: string) => void;
  onOpenWorkspace?: (clientId: string) => void;
}) {
  const initials = client.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <article className="group rounded-[28px] border border-white/10 bg-[#050505] p-5 shadow-[0_12px_30px_rgba(0,0,0,0.22)] transition duration-200 hover:-translate-y-0.5 hover:border-orange-500/30 hover:bg-[#080808] hover:shadow-[0_18px_40px_rgba(0,0,0,0.3)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-500/15 text-sm font-semibold text-orange-400">
            {initials || "CL"}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 text-orange-400">
              <Building2 size={16} />
              <p className="text-xs font-semibold uppercase tracking-[0.22em]">
                Client
              </p>
            </div>

            <h3 className="mt-3 truncate text-xl font-semibold text-white">
              {client.name}
            </h3>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              {client.industry ? (
                <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs font-medium text-orange-300">
                  {client.industry}
                </span>
              ) : null}

              {metaLabel ? (
                <span className="text-xs text-white/40">{metaLabel}</span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
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

        {!client.email && !client.phone && !client.website ? (
          <p className="text-sm text-white/45">
            No contact details saved yet.
          </p>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {onOpenDetails ? (
          <button
            type="button"
            onClick={() => onOpenDetails(client.id)}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/85 transition hover:border-orange-500/30 hover:text-white"
          >
            Profile
            <ArrowRight size={14} />
          </button>
        ) : null}

        {onOpenWorkspace ? (
          <button
            type="button"
            onClick={() => onOpenWorkspace(client.id)}
            className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-orange-400"
          >
            <Briefcase size={14} />
            Workspace
          </button>
        ) : null}
      </div>
    </article>
  );
}
