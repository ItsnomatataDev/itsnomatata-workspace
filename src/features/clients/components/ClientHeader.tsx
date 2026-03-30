// Update the import path below to match your actual file structure
import type { Client } from "../../../lib/supabase/queries/clients";

interface ClientHeaderProps {
  client: Client;
}

export default function ClientHeader({ client }: ClientHeaderProps) {
  return (
    <div className="rounded-2xl border p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{client.name}</h1>
          <p className="text-sm text-gray-500">
            {client.industry || "No industry"} · {client.status}
          </p>
        </div>

        {client.website_url ? (
          <a
            href={client.website_url}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border px-4 py-2 text-sm font-medium"
          >
            Visit Website
          </a>
        ) : null}
      </div>

      <p className="mt-4 text-sm text-gray-700">
        {client.description || "No description available."}
      </p>

      {client.brand_voice ? (
        <div className="mt-4 rounded-xl bg-gray-50 p-3 text-sm">
          <span className="font-semibold">Brand voice:</span>{" "}
          {client.brand_voice}
        </div>
      ) : null}
    </div>
  );
}
