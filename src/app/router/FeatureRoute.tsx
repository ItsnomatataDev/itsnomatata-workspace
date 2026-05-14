import type { ReactNode } from "react";
import Sidebar from "../../components/dashboard/components/Sidebar";
import { useOrganizationFeatures, type FeatureKey } from "../../lib/hooks/useOrganizationFeatures";

function FeatureDisabledMessage({ featureKey }: { featureKey: string }) {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <Sidebar />
        <main className="flex flex-1 items-center justify-center p-6">
          <div className="max-w-md rounded-3xl border border-white/10 bg-white/5 p-6 text-center shadow-xl shadow-black/40">
            <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
              Feature Disabled
            </p>
            <h1 className="mt-3 text-2xl font-bold text-white">
              This feature is not enabled for your organization.
            </h1>
            <p className="mt-3 text-sm leading-6 text-white/60">
              Contact your organization admin to request access to {featureKey.replace(/_/g, " ")}.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function FeatureRoute({
  feature,
  children,
}: {
  feature: FeatureKey;
  children: ReactNode;
}) {
  const { loading, isEnabled } = useOrganizationFeatures();

  if (loading) {
    return (
      <div className="min-h-screen bg-black p-6 text-white">
        Checking feature access...
      </div>
    );
  }

  if (!isEnabled(feature)) {
    return <FeatureDisabledMessage featureKey={feature} />;
  }

  return <>{children}</>;
}
