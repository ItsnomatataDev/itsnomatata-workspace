import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../../lib/supabase/client";
import { useAuth } from "../../../app/providers/AuthProvider";
import { getDefaultAuthenticatedPath } from "../../../lib/supabase/auth";

type InvitationRow = {
  id: string;
  organization_id: string;
  email: string;
  full_name: string | null;
  role_key: string;
  status: string;
  expires_at: string | null;
  organizations?: { name: string; slug: string } | null;
};

export default function AcceptOrganizationInvitePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const user = auth?.user ?? null;
  const [status, setStatus] = useState("Checking invitation...");
  const [error, setError] = useState("");
  const [accepting, setAccepting] = useState(false);
  const [invitation, setInvitation] = useState<InvitationRow | null>(null);

  useEffect(() => {
    async function loadInvite() {
      if (!token) return;

      try {
        setError("");
        const { data, error: inviteError } = await supabase
          .rpc("get_organization_invitation_by_token", {
            invitation_token: token,
          })
          .maybeSingle();

        if (inviteError) throw inviteError;
        if (!data) throw new Error("This invitation was not found or is no longer pending.");
        const rawInvite = data as unknown as InvitationRow & {
          organization_name?: string | null;
          organization_slug?: string | null;
        };
        if (user?.email && rawInvite.email.toLowerCase() !== user.email.toLowerCase()) {
          throw new Error("This invitation belongs to a different email address.");
        }
        if (rawInvite.expires_at && new Date(rawInvite.expires_at).getTime() < Date.now()) {
          throw new Error("This invitation has expired.");
        }

        setInvitation({
          ...rawInvite,
          organizations: {
            name: rawInvite.organization_name ?? "organization",
            slug: rawInvite.organization_slug ?? "",
          },
        });
        setStatus("Invitation ready.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load invitation.");
      }
    }

    void loadInvite();
  }, [token, user?.email]);

  async function acceptInvite() {
    if (!invitation || !user) return;

    try {
      setAccepting(true);
      setError("");

      const { data, error: acceptError } = await supabase
        .rpc("maybe_accept_invitation_for_current_user", {
          invitation_id: invitation.id,
          invitation_token: token ?? null,
        })
        .maybeSingle();

      if (acceptError) throw acceptError;
      const acceptance = data as
        | { accepted?: boolean; role?: string | null }
        | null;
      if (!acceptance?.accepted) {
        throw new Error("This invitation could not be accepted for your account.");
      }

      await auth?.refreshProfile();
      navigate(getDefaultAuthenticatedPath(acceptance.role), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept invitation.");
    } finally {
      setAccepting(false);
    }
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black p-6 text-white">
        <div className="max-w-md rounded-3xl border border-white/10 bg-white/5 p-6 text-center">
          <h1 className="text-xl font-semibold">
            Join {invitation?.organizations?.name ?? "your organization"}
          </h1>
          <p className="mt-2 text-sm text-white/60">
            {invitation
              ? `You were invited as ${invitation.role_key}. Create your account with ${invitation.email} to enter this workspace.`
              : "Checking your organization invite."}
          </p>
          {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
          <div className="mt-5 grid gap-3">
            <button
              type="button"
              onClick={() => navigate(`/signup?invite=${token}`)}
              disabled={!invitation || Boolean(error)}
              className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black hover:bg-orange-400 disabled:opacity-50"
            >
              Create Account
            </button>
            <button
              type="button"
              onClick={() => navigate(`/login?invite=${token}`)}
              className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10"
            >
              I already have an account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black p-6 text-white">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/5 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
          Organization Invite
        </p>
        <h1 className="mt-3 text-2xl font-bold">
          Join {invitation?.organizations?.name ?? "organization"}
        </h1>
        <p className="mt-3 text-sm text-white/60">{error || status}</p>
        <button
          type="button"
          disabled={!invitation || accepting || Boolean(error)}
          onClick={() => void acceptInvite()}
          className="mt-6 w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {accepting ? "Joining..." : "Accept Invitation"}
        </button>
      </div>
    </div>
  );
}
