import { supabase } from "../supabase/client";

export type ResolvedHostOrganization = {
  id: string;
  name: string;
  slug: string;
  status: string | null;
  access_status: string | null;
  is_active: boolean | null;
  is_system_organization: boolean | null;
  domain: string | null;
  domain_status: string | null;
};

const MAIN_SYSTEM_HOST = "codex.itsnomatata.com";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
let hasHostResolutionRpc = true;

function isMissingRpcError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const record = error as Record<string, unknown>;
  return (
    record.code === "PGRST202" ||
    String(record.message ?? "").includes("Could not find the function")
  );
}

export function getCurrentHostname() {
  if (typeof window === "undefined") return null;
  return window.location.hostname.toLowerCase();
}

export function isMainSystemHostname(hostname?: string | null) {
  if (!hostname) return false;
  return hostname.toLowerCase() === MAIN_SYSTEM_HOST;
}

export function isLocalDevelopmentHostname(hostname?: string | null) {
  if (!hostname) return false;
  const normalized = hostname.toLowerCase();
  return LOCAL_HOSTS.has(normalized) || normalized.endsWith(".local");
}

export async function resolveOrganizationByHost(hostname?: string | null) {
  const host = (hostname ?? getCurrentHostname())?.trim().toLowerCase();
  if (!host || isLocalDevelopmentHostname(host) || !hasHostResolutionRpc) {
    return null;
  }

  const { data, error } = await supabase
    .rpc("get_organization_by_host", { host_name: host })
    .maybeSingle();

  if (error) {
    if (isMissingRpcError(error)) {
      hasHostResolutionRpc = false;
      return null;
    }
    console.warn("ORGANIZATION HOST RESOLUTION ERROR:", error);
    return null;
  }

  return (data ?? null) as ResolvedHostOrganization | null;
}
