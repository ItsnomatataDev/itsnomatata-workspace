import { ArrowRight, CalendarDays, Clock3, LogOut } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { contentClientSessionKey } from "./ClientPortalLoginPage";
import {
  getContentClientPortal,
  type ContentClientPortalSession,
  type ContentPortalDraftCard,
} from "../services/contentReviewService";

function formatStatus(status: string) {
  return status.replace(/_/g, " ");
}

function portalCardLabel(draft: ContentPortalDraftCard) {
  if (draft.can_review === false) {
    if (draft.status === "approved" || draft.status === "ready_for_review") {
      return "Awaiting release";
    }
    return "In preparation";
  }
  if (draft.status === "ready_for_review" || draft.status === "sent_to_client") {
    return "new";
  }
  return draft.status;
}

function statusClass(draft: ContentPortalDraftCard) {
  const display = portalCardLabel(draft);
  if (display === "Awaiting release" || display === "In preparation") {
    return "bg-amber-100 text-amber-900";
  }
  if (display === "approved" || display === "published") {
    return "bg-emerald-100 text-emerald-800";
  }
  if (display === "changes_requested") return "bg-orange-100 text-orange-800";
  if (display === "archived") return "bg-neutral-200 text-neutral-600";
  return "bg-black text-white";
}

export default function ClientPortalPage() {
  const { clientToken = "" } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<ContentClientPortalSession | null>(null);
  const [drafts, setDrafts] = useState<ContentPortalDraftCard[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const { releasedDrafts, pendingDrafts } = useMemo(() => {
    const released: ContentPortalDraftCard[] = [];
    const pending: ContentPortalDraftCard[] = [];
    for (const draft of drafts) {
      if (draft.can_review !== false) {
        released.push(draft);
      } else {
        pending.push(draft);
      }
    }
    return { releasedDrafts: released, pendingDrafts: pending };
  }, [drafts]);

  const load = useCallback(async () => {
    const raw = localStorage.getItem(contentClientSessionKey(clientToken));
    if (!raw) {
      navigate(`/client-portal/${clientToken}/login`);
      return;
    }
    const parsed = JSON.parse(raw) as ContentClientPortalSession;
    try {
      setLoading(true);
      const result = await getContentClientPortal({
        clientToken,
        sessionToken: parsed.sessionToken,
        email: parsed.email,
      });
      if (!result.ok || !result.client) {
        localStorage.removeItem(contentClientSessionKey(clientToken));
        navigate(`/client-portal/${clientToken}/login`);
        return;
      }
      setSession({ ...parsed, client: result.client });
      setDrafts(result.drafts ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load portal.");
    } finally {
      setLoading(false);
    }
  }, [clientToken, navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  function logout() {
    localStorage.removeItem(contentClientSessionKey(clientToken));
    navigate(`/client-portal/${clientToken}/login`);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-100 text-neutral-900">
        Loading portal...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-6 text-neutral-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="rounded-3xl bg-black p-6 text-white shadow-xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-orange-400">
                Client Review Portal
              </p>
              <h1 className="mt-3 text-3xl font-bold sm:text-5xl">
                {session?.client.company_name}
              </h1>
              <p className="mt-2 text-white/65">
                {session?.client.contact_name} · {session?.client.email}
              </p>
            </div>
            <button
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-white/70 hover:bg-white/10"
            >
              <LogOut size={15} /> Sign out
            </button>
          </div>
        </header>

        {error ? (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        ) : null}

        {drafts.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-neutral-200 bg-white p-8 text-neutral-600">
            <p className="font-semibold text-neutral-900">No schedules on this portal yet</p>
            <p className="mt-2 text-sm leading-relaxed">
              Nothing has been linked to this portal login yet. Your content team should open
              Content Studio → Clients, pick your company, confirm the monthly schedule is there,
              then use <strong>Send to client</strong> when posts are ready for you to review.
            </p>
          </div>
        ) : null}

        {releasedDrafts.length > 0 ? (
          <section className="mt-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Ready for your review
            </h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {releasedDrafts.map((draft) => (
                <PortalScheduleCard
                  key={draft.id}
                  draft={draft}
                  clientToken={clientToken}
                  actionable
                />
              ))}
            </div>
          </section>
        ) : null}

        {pendingDrafts.length > 0 ? (
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
              In preparation
            </h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {pendingDrafts.map((draft) => (
                <PortalScheduleCard
                  key={draft.id}
                  draft={draft}
                  clientToken={clientToken}
                  actionable={false}
                />
              ))}
            </div>
          </section>
        ) : null}

        {drafts.length > 0 && releasedDrafts.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Schedules are assigned to your account but not released for review yet. Your team
            will notify you once they send them from Content Studio.
          </p>
        ) : null}
      </div>
    </main>
  );
}

function PortalScheduleCard({
  draft,
  clientToken,
  actionable,
}: {
  draft: ContentPortalDraftCard;
  clientToken: string;
  actionable: boolean;
}) {
  const label = portalCardLabel(draft);

  return (
    <article className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-lg">
      {draft.thumbnail_url ? (
        <div className="aspect-video w-full bg-neutral-100">
          <img
            src={draft.thumbnail_url}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-contain sm:object-cover"
          />
        </div>
      ) : (
        <div className="aspect-video bg-neutral-200" />
      )}
      <div className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${statusClass(draft)}`}
          >
            {formatStatus(label)}
          </span>
          {draft.scheduled_at ? (
            <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
              <CalendarDays size={13} />{" "}
              {new Date(draft.scheduled_at).toLocaleDateString()}
            </span>
          ) : null}
        </div>
        <h2 className="mt-3 text-xl font-bold">{draft.title}</h2>
        {draft.summary ? (
          <p className="mt-2 line-clamp-3 text-sm text-neutral-600">{draft.summary}</p>
        ) : null}
        {actionable ? (
          <Link
            to={`/client-portal/${clientToken}/reviews/${draft.id}`}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-black hover:bg-orange-400"
          >
            Open review <ArrowRight size={15} />
          </Link>
        ) : (
          <p className="mt-4 inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
            <Clock3 size={15} />
            Waiting for your team to send this schedule
          </p>
        )}
      </div>
    </article>
  );
}
