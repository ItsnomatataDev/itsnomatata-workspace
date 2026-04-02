import Sidebar from "../../../components/dashboard/components/Siderbar";
import { useAuth } from "../../../app/providers/AuthProvider";

export default function AIWorkspacePage() {
  const auth = useAuth();
  const profile = auth?.profile ?? null;

  if (!profile) {
    return (
      <div className="min-h-screen bg-black p-6 text-white">
        Missing AI workspace context.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen">
        <Sidebar role={profile.primary_role} />

        <main className="flex-1 p-6 lg:p-8">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
              AI Workspace
            </p>
            <h1 className="mt-2 text-3xl font-bold">AI Workspace</h1>
            <p className="mt-2 text-sm text-white/50">
              This page is temporarily simplified so the app can build and be
              tested.
            </p>
          </div>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold">Coming soon</h2>
            <p className="mt-2 text-sm text-white/60">
              The AI workspace will be restored after the rest of the system is
              stable.
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}
