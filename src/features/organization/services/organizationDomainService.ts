import { supabase } from "../../../lib/supabase/client";
import type { OrganizationDomain } from "../../platform-admin/types/platformAdmin";

type DomainAction =
  | "create"
  | "list"
  | "verify_dns"
  | "connect_provider"
  | "refresh_provider"
  | "delete";

async function getFunctionErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "context" in error) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      const contentType = context.headers.get("content-type") ?? "";
      try {
        if (contentType.includes("application/json")) {
          const payload = await context.clone().json();
          if (typeof payload?.error === "string") return payload.error;
          if (typeof payload?.message === "string") return payload.message;
        }
        const text = await context.clone().text();
        if (text.trim()) return text;
      } catch {
        // Fall through to the generic error shape below.
      }
    }
  }

  if (error instanceof Error && error.message) return error.message;
  return "Domain service request failed.";
}

async function invokeDomainFunction<T>(body: {
  action: DomainAction;
  organizationId?: string;
  domainId?: string;
  domain?: string;
}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("organization-domain", {
    body,
  });

  if (error) throw new Error(await getFunctionErrorMessage(error));
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export async function getOrganizationDomains(organizationId: string) {
  const result = await invokeDomainFunction<{
    ok: true;
    domains: OrganizationDomain[];
  }>({
    action: "list",
    organizationId,
  });

  return result.domains;
}

export async function createOrganizationDomain(params: {
  organizationId: string;
  domain: string;
}) {
  const result = await invokeDomainFunction<{
    ok: true;
    domain: OrganizationDomain;
  }>({
    action: "create",
    organizationId: params.organizationId,
    domain: params.domain,
  });

  return result.domain;
}

export async function verifyOrganizationDomainDns(domainId: string) {
  return invokeDomainFunction<{
    ok: boolean;
    domain?: OrganizationDomain;
    error?: string;
    cnameValues?: string[];
    txtValues?: string[];
  }>({
    action: "verify_dns",
    domainId,
  });
}

export async function connectOrganizationDomainToProvider(domainId: string) {
  return invokeDomainFunction<{
    ok: boolean;
    domain?: OrganizationDomain;
    error?: string;
    providerConfigured?: boolean;
  }>({
    action: "connect_provider",
    domainId,
  });
}

export async function refreshOrganizationDomainProvider(domainId: string) {
  return invokeDomainFunction<{
    ok: boolean;
    domain?: OrganizationDomain;
    error?: string;
    providerConfigured?: boolean;
  }>({
    action: "refresh_provider",
    domainId,
  });
}

export async function deleteOrganizationDomain(domainId: string) {
  return invokeDomainFunction<{ ok: true }>({
    action: "delete",
    domainId,
  });
}
