import { useState } from "react";
import { useAuth } from "../../../app/providers/AuthProvider";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import AIDashboard from "../components/AIDashboard";

export default function SocialMediaDashboardPage() {
  const auth = useAuth();

  if (!auth?.user || !auth?.profile) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Authentication Required</h2>
          <p className="text-white/60">Please log in to access the Social Media Dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen">
        <Sidebar role={auth.profile.primary_role} />
        <main className="flex-1 p-6 lg:p-8">
          <AIDashboard organizationId={auth.profile.organization_id || ""} />
        </main>
      </div>
    </div>
  );
}
