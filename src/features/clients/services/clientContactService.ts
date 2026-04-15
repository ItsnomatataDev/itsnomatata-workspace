import { supabase } from "../../../lib/supabase/client";

export interface ClientContactItem {
  id: string;
  organization_id: string;
  client_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export async function getClientContacts(params: {
  organizationId: string;
  clientId: string;
}): Promise<ClientContactItem[]> {
  const { organizationId, clientId } = params;

  if (!organizationId) throw new Error("organizationId is required");
  if (!clientId) throw new Error("clientId is required");

  const { data, error } = await supabase
    .from("client_contacts")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("client_id", clientId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as ClientContactItem[];
}


export async function createClientContact(params: {
  organizationId: string;
  clientId: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  isPrimary?: boolean;
  sendInvite?: boolean;
}) {
  const {
    organizationId,
    clientId,
    fullName,
    email,
    phone,
    title,
    isPrimary = false,
    sendInvite = false,
  } = params;

  if (!organizationId) throw new Error("organizationId is required");
  if (!clientId) throw new Error("clientId is required");
  if (!fullName) throw new Error("fullName is required");

  const { data, error } = await supabase
    .from("client_contacts")
    .insert({
      organization_id: organizationId,
      client_id: clientId,
      full_name: fullName,
      email: email ?? null,
      phone: phone ?? null,
      title: title ?? null,
      is_primary: isPrimary,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create contact: ${error.message}`);
  }

  if (sendInvite && email) {
    await sendClientInviteEmail({
      email,
      fullName,
      clientId,
      organizationId,
    });
  }

  return data as ClientContactItem;
}


async function sendClientInviteEmail(params: {
  email: string;
  fullName: string;
  clientId: string;
  organizationId: string;
}) {
  try {
    const { error } = await supabase.functions.invoke(
      "send-client-invite",
      {
        body: {
          email: params.email,
          fullName: params.fullName,
          clientId: params.clientId,
          organizationId: params.organizationId,
        },
      },
    );

    if (error) {
      console.error("Invite email failed:", error.message);
    }
  } catch (err) {
    console.error("Invite email error:", err);
  }
}