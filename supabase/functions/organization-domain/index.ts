import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type DomainAction =
  | "create"
  | "list"
  | "verify_dns"
  | "connect_provider"
  | "refresh_provider"
  | "delete";

type RequestBody = {
  action?: DomainAction;
  organizationId?: string;
  domainId?: string;
  domain?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function getBearerToken(req: Request) {
  const authorization = req.headers.get("authorization") ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return null;
  return authorization.slice(7).trim() || null;
}

function normalizeDomain(input: string) {
  return input.trim().toLowerCase().replace(/\.$/, "");
}

function isIpAddress(value: string) {
  return /^[0-9]{1,3}(\.[0-9]{1,3}){3}$/.test(value) || value.includes(":");
}

function validateDomain(input: string) {
  const domain = normalizeDomain(input);
  if (!domain) return { ok: false as const, error: "Domain is required." };
  if (domain.includes("://")) return { ok: false as const, error: "Do not include https:// or http://." };
  if (domain.includes("/")) return { ok: false as const, error: "Do not include a path or trailing slash." };
  if (/\s/.test(domain)) return { ok: false as const, error: "Domain cannot contain spaces." };
  if (domain.startsWith("*.")) return { ok: false as const, error: "Wildcard domains are not supported yet." };
  if (["localhost", "127.0.0.1", "::1"].includes(domain)) return { ok: false as const, error: "Localhost cannot be connected as a custom domain." };
  if (isIpAddress(domain)) return { ok: false as const, error: "IP addresses cannot be connected as custom domains." };
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/.test(domain)) {
    return { ok: false as const, error: "Enter a valid hostname, for example portal.company.com." };
  }
  if (domain === "codex.itsnomatata.com") return { ok: false as const, error: "codex.itsnomatata.com is the platform domain." };
  return { ok: true as const, domain };
}

function dnsHosts(domain: string, cnameTarget: string) {
  const labels = domain.split(".");
  const firstLabel = labels[0];
  return {
    cname_host: firstLabel,
    cname_fqdn: domain,
    cname_target: cnameTarget,
    txt_host: `_itsnomatata-verify.${firstLabel}`,
    txt_fqdn: `_itsnomatata-verify.${domain}`,
  };
}

function normalizeDnsValue(value: string) {
  return value.trim().toLowerCase().replace(/\.$/, "");
}

async function resolveCname(domain: string) {
  try {
    return await Deno.resolveDns(domain, "CNAME");
  } catch {
    return [];
  }
}

async function resolveTxt(domain: string) {
  try {
    return (await Deno.resolveDns(domain, "TXT")).map((chunks) => chunks.join(""));
  } catch {
    return [];
  }
}

async function assertActorCanManage(adminClient: any, actorUserId: string, organizationId: string) {
  const { data: actor, error } = await adminClient
    .from("profiles")
    .select("id, email, organization_id, primary_role, account_status, is_suspended")
    .eq("id", actorUserId)
    .maybeSingle();

  if (error) throw error;
  if (!actor) return false;
  if (actor.account_status && actor.account_status !== "active") return false;
  if (actor.is_suspended) return false;

  const platformAdminLookup = adminClient
    .from("platform_admins")
    .select("id")
    .eq("is_active", true);

  const email = typeof actor.email === "string" ? actor.email.trim() : "";
  const { data: platformAdmin } = await (
    email
      ? platformAdminLookup.or(`user_id.eq.${actorUserId},email.ilike.${email}`)
      : platformAdminLookup.eq("user_id", actorUserId)
  ).maybeSingle();

  if (platformAdmin) return true;
  return actor.organization_id === organizationId &&
    [
      "admin",
      "org_admin",
      "super_admin",
      "superadmin",
      "it-superadmin",
      "platform_owner",
      "platform_admin",
    ].includes(actor.primary_role ?? "");
}

async function audit(adminClient: any, params: {
  organizationId: string;
  actorUserId: string;
  action: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const metadata = {
    ...(params.metadata ?? {}),
    target_type: "organization_domain",
    domain_id: params.entityId ?? null,
  };

  const { error: platformAuditError } = await adminClient.from("platform_audit_logs").insert({
    target_organization_id: params.organizationId,
    actor_user_id: params.actorUserId,
    action: params.action,
    metadata,
  });
  if (platformAuditError) {
    console.warn("PLATFORM AUDIT LOG SKIPPED", platformAuditError);
  }

  const { error: domainAuditError } = await adminClient.from("organization_domain_audit_logs").insert({
    organization_id: params.organizationId,
    actor_user_id: params.actorUserId,
    action: params.action,
    domain_id: params.entityId ?? null,
    metadata,
  });
  if (domainAuditError) {
    console.warn("DOMAIN AUDIT LOG SKIPPED", domainAuditError);
  }
}

async function loadDomain(adminClient: any, domainId: string) {
  const { data, error } = await adminClient
    .from("organization_domains")
    .select("*")
    .eq("id", domainId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function verifyDns(adminClient: any, domainRecord: any, actorUserId: string) {
  const cnameValues = await resolveCname(domainRecord.domain);
  const normalizedCnames = cnameValues.map(normalizeDnsValue);
  const expectedCname = normalizeDnsValue(domainRecord.cname_target);
  const txtFqdn = domainRecord.txt_fqdn || `_itsnomatata-verify.${domainRecord.domain}`;
  const txtValues = await resolveTxt(txtFqdn);

  if (!normalizedCnames.length) {
    const message = "CNAME not found. DNS may still be propagating.";
    await adminClient.from("organization_domains").update({
      status: "dns_pending",
      last_checked_at: new Date().toISOString(),
      last_error: message,
    }).eq("id", domainRecord.id).throwOnError();
    await audit(adminClient, {
      organizationId: domainRecord.organization_id,
      actorUserId,
      action: "domain_dns_verification_attempted",
      entityId: domainRecord.id,
      metadata: { result: "cname_not_found", txtFqdn, txtValues },
    });
    return { ok: false, error: message, cnameValues, txtValues };
  }

  if (!normalizedCnames.includes(expectedCname)) {
    const message = `CNAME points to ${cnameValues.join(", ")}, expected ${domainRecord.cname_target}.`;
    await adminClient.from("organization_domains").update({
      status: "failed",
      last_checked_at: new Date().toISOString(),
      last_error: message,
    }).eq("id", domainRecord.id).throwOnError();
    return { ok: false, error: message, cnameValues, txtValues };
  }

  if (!txtValues.length) {
    const message = "TXT verification record not found. DNS may still be propagating.";
    await adminClient.from("organization_domains").update({
      status: "dns_pending",
      last_checked_at: new Date().toISOString(),
      last_error: message,
    }).eq("id", domainRecord.id).throwOnError();
    return { ok: false, error: message, cnameValues, txtValues };
  }

  if (!txtValues.includes(domainRecord.txt_value)) {
    const message = "TXT token mismatch. Check the verification value exactly.";
    await adminClient.from("organization_domains").update({
      status: "failed",
      last_checked_at: new Date().toISOString(),
      last_error: message,
    }).eq("id", domainRecord.id).throwOnError();
    return { ok: false, error: message, cnameValues, txtValues };
  }

  const now = new Date().toISOString();
  const { data, error } = await adminClient
    .from("organization_domains")
    .update({
      status: "verified",
      verified_at: domainRecord.verified_at ?? now,
      last_checked_at: now,
      last_error: null,
    })
    .eq("id", domainRecord.id)
    .select("*")
    .single();
  if (error) throw error;

  await audit(adminClient, {
    organizationId: domainRecord.organization_id,
    actorUserId,
    action: "domain_dns_verified",
    entityId: domainRecord.id,
    metadata: { domain: domainRecord.domain },
  });

  return { ok: true, domain: data, cnameValues, txtValues };
}

async function fetchVercelDomainConfig(domain: string) {
  const token = Deno.env.get("VERCEL_TOKEN");
  const projectId = Deno.env.get("VERCEL_PROJECT_ID");
  const teamId = Deno.env.get("VERCEL_TEAM_ID");

  if (!token || !projectId) {
    return { ok: false as const, providerConfigured: false, error: "DNS verified, but provider connection is not configured." };
  }

  const query = teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
  const [projectDomainResponse, domainConfigResponse] = await Promise.all([
    fetch(`https://api.vercel.com/v9/projects/${projectId}/domains/${encodeURIComponent(domain)}${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
    fetch(`https://api.vercel.com/v6/domains/${encodeURIComponent(domain)}/config${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
  ]);

  const projectDomain = await projectDomainResponse.json().catch(() => ({}));
  const domainConfig = await domainConfigResponse.json().catch(() => ({}));

  return {
    ok: projectDomainResponse.ok || domainConfigResponse.ok,
    providerConfigured: true,
    projectDomain,
    domainConfig,
    error:
      projectDomain?.error?.message ||
      domainConfig?.error?.message ||
      "Unable to refresh provider status.",
  };
}

async function refreshVercelStatus(adminClient: any, domainRecord: any, actorUserId: string) {
  const result = await fetchVercelDomainConfig(domainRecord.domain);

  if (!result.providerConfigured) {
    const message = result.error;
    await adminClient.from("organization_domains").update({
      last_checked_at: new Date().toISOString(),
      last_error: message,
    }).eq("id", domainRecord.id).throwOnError();
    return { ok: false, error: message, providerConfigured: false };
  }

  if (!result.ok) {
    await adminClient.from("organization_domains").update({
      last_checked_at: new Date().toISOString(),
      last_error: result.error,
    }).eq("id", domainRecord.id).throwOnError();
    return { ok: false, error: result.error, provider: result };
  }

  const configuredBy = result.domainConfig?.configuredBy ?? null;
  const misconfigured = Boolean(result.domainConfig?.misconfigured);
  const verified = result.projectDomain?.verified !== false;
  const hasActiveSsl =
    result.projectDomain?.verification === undefined &&
    result.projectDomain?.error === undefined &&
    !misconfigured;
  const status = verified ? "connected" : "failed";
  const sslStatus = hasActiveSsl ? "active" : "issuing";
  const message = misconfigured
    ? `Domain is attached to Vercel, but DNS is still misconfigured${configuredBy ? ` (${configuredBy})` : ""}. Update the CNAME record and refresh SSL.`
    : null;
  const now = new Date().toISOString();

  const { data, error } = await adminClient
    .from("organization_domains")
    .update({
      status,
      ssl_status: sslStatus,
      last_checked_at: now,
      last_error: message,
    })
    .eq("id", domainRecord.id)
    .select("*")
    .single();
  if (error) throw error;

  await audit(adminClient, {
    organizationId: domainRecord.organization_id,
    actorUserId,
    action: "domain_provider_refreshed",
    entityId: domainRecord.id,
    metadata: {
      provider: "vercel",
      configuredBy,
      misconfigured,
      verified,
    },
  });

  return { ok: verified, domain: data, provider: result };
}

async function connectVercel(adminClient: any, domainRecord: any, actorUserId: string) {
  const token = Deno.env.get("VERCEL_TOKEN");
  const projectId = Deno.env.get("VERCEL_PROJECT_ID");
  const teamId = Deno.env.get("VERCEL_TEAM_ID");

  if (!token || !projectId) {
    const message = "DNS verified, but provider connection is not configured.";
    await adminClient.from("organization_domains").update({
      status: domainRecord.status === "verified" ? "verified" : domainRecord.status,
      last_checked_at: new Date().toISOString(),
      last_error: message,
    }).eq("id", domainRecord.id).throwOnError();
    return { ok: false, error: message, providerConfigured: false };
  }

  const query = teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
  const addResponse = await fetch(`https://api.vercel.com/v10/projects/${projectId}/domains${query}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: domainRecord.domain }),
  });

  const addJson = await addResponse.json().catch(() => ({}));
  if (!addResponse.ok && addResponse.status !== 409) {
    const message = addJson?.error?.message ?? "Provider connection failed.";
    await adminClient.from("organization_domains").update({
      status: "failed",
      ssl_status: "failed",
      last_checked_at: new Date().toISOString(),
      last_error: message,
    }).eq("id", domainRecord.id).throwOnError();
    return { ok: false, error: message, provider: addJson };
  }

  const now = new Date().toISOString();
  const { data, error } = await adminClient
    .from("organization_domains")
    .update({
      status: "connected",
      ssl_status: "issuing",
      provider_domain_id: addJson?.id ?? addJson?.uid ?? domainRecord.provider_domain_id,
      connected_at: domainRecord.connected_at ?? now,
      last_checked_at: now,
      last_error: null,
    })
    .eq("id", domainRecord.id)
    .select("*")
    .single();
  if (error) throw error;

  await audit(adminClient, {
    organizationId: domainRecord.organization_id,
    actorUserId,
    action: "domain_connected",
    entityId: domainRecord.id,
    metadata: { provider: "vercel", domain: domainRecord.domain },
  });

  return await refreshVercelStatus(adminClient, data, actorUserId);
}

async function removeVercelDomain(domain: string) {
  const token = Deno.env.get("VERCEL_TOKEN");
  const projectId = Deno.env.get("VERCEL_PROJECT_ID");
  const teamId = Deno.env.get("VERCEL_TEAM_ID");
  if (!token || !projectId) return;

  const query = teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
  await fetch(`https://api.vercel.com/v9/projects/${projectId}/domains/${encodeURIComponent(domain)}${query}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => undefined);
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return jsonResponse({ error: "Domain function is not configured." }, 500);
    }

    const bearer = getBearerToken(req);
    if (!bearer) return jsonResponse({ error: "Missing Authorization bearer token." }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
      auth: { persistSession: false },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser(bearer);
    if (authError || !authData.user) return jsonResponse({ error: "Invalid or expired session." }, 401);

    const body = (await req.json()) as RequestBody;
    const action = body.action;
    if (!action) return jsonResponse({ error: "Action is required." }, 400);

    if (action === "list") {
      if (!body.organizationId) return jsonResponse({ error: "organizationId is required." }, 400);
      if (!(await assertActorCanManage(adminClient, authData.user.id, body.organizationId))) {
        return jsonResponse({ error: "Forbidden." }, 403);
      }
      const { data, error } = await adminClient
        .from("organization_domains")
        .select("*")
        .eq("organization_id", body.organizationId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return jsonResponse({ ok: true, domains: data ?? [] });
    }

    if (action === "create") {
      if (!body.organizationId) return jsonResponse({ error: "organizationId is required." }, 400);
      if (!(await assertActorCanManage(adminClient, authData.user.id, body.organizationId))) {
        return jsonResponse({ error: "Forbidden." }, 403);
      }
      const validated = validateDomain(body.domain ?? "");
      if (!validated.ok) return jsonResponse({ error: validated.error }, 400);

      const cnameTarget = Deno.env.get("PLATFORM_CNAME_TARGET") ?? "cname.vercel-dns.com";
      const hosts = dnsHosts(validated.domain, cnameTarget);
      const txtValue = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");

      const { data, error } = await adminClient
        .from("organization_domains")
        .insert({
          organization_id: body.organizationId,
          domain: validated.domain,
          domain_type: "subdomain",
          status: "pending",
          cname_host: hosts.cname_host,
          cname_fqdn: hosts.cname_fqdn,
          cname_target: hosts.cname_target,
          txt_host: hosts.txt_host,
          txt_fqdn: hosts.txt_fqdn,
          txt_value: txtValue,
          ssl_status: "pending",
          provider: "vercel",
          created_by: authData.user.id,
        })
        .select("*")
        .single();

      if (error) {
        if (String(error.message).toLowerCase().includes("duplicate")) {
          return jsonResponse({ error: "This domain is already claimed." }, 409);
        }
        throw error;
      }

      await audit(adminClient, {
        organizationId: body.organizationId,
        actorUserId: authData.user.id,
        action: "domain_created",
        entityId: data.id,
        metadata: { domain: data.domain },
      });

      return jsonResponse({ ok: true, domain: data });
    }

    if (!body.domainId) return jsonResponse({ error: "domainId is required." }, 400);
    const domainRecord = await loadDomain(adminClient, body.domainId);
    if (!domainRecord) return jsonResponse({ error: "Domain was not found." }, 404);
    if (!(await assertActorCanManage(adminClient, authData.user.id, domainRecord.organization_id))) {
      return jsonResponse({ error: "Forbidden." }, 403);
    }

    if (action === "verify_dns") {
      return jsonResponse(await verifyDns(adminClient, domainRecord, authData.user.id));
    }

    if (action === "connect_provider" || action === "refresh_provider") {
      if (!["verified", "connected"].includes(domainRecord.status)) {
        return jsonResponse({ error: "DNS must be verified before connecting provider." }, 400);
      }
      return jsonResponse(
        action === "connect_provider"
          ? await connectVercel(adminClient, domainRecord, authData.user.id)
          : await refreshVercelStatus(adminClient, domainRecord, authData.user.id),
      );
    }

    if (action === "delete") {
      await removeVercelDomain(domainRecord.domain);
      const { error } = await adminClient
        .from("organization_domains")
        .delete()
        .eq("id", domainRecord.id);
      if (error) throw error;
      await audit(adminClient, {
        organizationId: domainRecord.organization_id,
        actorUserId: authData.user.id,
        action: "domain_removed",
        entityId: domainRecord.id,
        metadata: { domain: domainRecord.domain },
      });
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: "Invalid action." }, 400);
  } catch (error) {
    console.error("ORGANIZATION DOMAIN FUNCTION ERROR", error);
    return jsonResponse({
      error: error instanceof Error ? error.message : "Unexpected domain service error.",
    }, 500);
  }
});
