import { useState } from "react";
import SocialMediaSidebar from "../../../components/dashboard/components/SocialMediaSidebar";
import SocialMediaManager from "../components/SocialMediaManager";
import { useAuth } from "../../../app/providers/AuthProvider";
import { type ContentStrategy } from "../services/AISocialMediaManager";

export default function SocialMediaManagerPage() {
  const auth = useAuth();
  const user = auth?.user;
  const profile = auth?.profile;
  const organizationId = profile?.organization_id;

  const handleContentGenerated = (strategy: ContentStrategy) => {
    console.log("Content strategy generated:", strategy);
    // Here you could save to database, trigger notifications, etc.
  };

  if (!user || !profile) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Authentication Required</h2>
          <p className="text-white/60">Please log in to access the Social Media Manager.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white lg:flex">
      <SocialMediaSidebar />
      
      <div className="flex-1 lg:ml-64">
        <div className="p-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Social Media Manager</h1>
            <p className="text-white/60">
              AI-powered content creation and optimization for your brand
            </p>
          </div>
          
          <SocialMediaManager onContentGenerated={handleContentGenerated} />
        </div>
      </div>
    </div>
  );
}
