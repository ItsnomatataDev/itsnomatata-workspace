import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Mail, Save, UserRound } from "lucide-react";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import { useAuth } from "../../../app/providers/AuthProvider";
import UserAvatar from "../../../components/common/UserAvatar";
import {
  updateMyProfile,
  uploadProfilePicture,
} from "../services/profileService";

export default function ProfilePage() {
  const auth = useAuth();
  const user = auth?.user ?? null;
  const profile = auth?.profile ?? null;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [username, setUsername] = useState(
    typeof profile?.username === "string" ? profile.username : "",
  );
  const [avatarUrl, setAvatarUrl] = useState(
    typeof profile?.avatar_url === "string" ? profile.avatar_url : "",
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? "");
    setUsername(
      typeof profile.username === "string"
        ? profile.username
        : profile.full_name ?? "",
    );
    setAvatarUrl(typeof profile.avatar_url === "string" ? profile.avatar_url : "");
  }, [profile?.avatar_url, profile?.full_name, profile?.username]);

  if (!user || !profile) return null;

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const uploaded = await uploadProfilePicture({ userId: user.id, file });
      setAvatarUrl(uploaded.publicUrl);
      await updateMyProfile({
        userId: user.id,
        fullName,
        username,
        avatarUrl: uploaded.publicUrl,
      });
      await auth.refreshProfile();
      setMessage("Profile picture updated.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update profile picture.",
      );
    } finally {
      setSaving(false);
      event.target.value = "";
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      await updateMyProfile({
        userId: user.id,
        fullName,
        username,
        avatarUrl,
      });
      await auth.refreshProfile();
      setMessage("Profile updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <Sidebar role={profile.primary_role ?? "manager"} />

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-8 rounded-2xl border border-white/10 bg-[#050505] p-5">
            <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
              Account
            </p>
            <h1 className="mt-2 text-3xl font-bold">Profile</h1>
            <p className="mt-2 text-sm text-white/50">
              Update the identity that appears across tasks, chat, meetings, and reports.
            </p>
          </div>

          <section className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <div className="rounded-2xl border border-white/10 bg-[#050505] p-5">
              <div className="flex flex-col items-center text-center">
                <UserAvatar
                  person={profile}
                  src={avatarUrl}
                  size="xl"
                  className="h-24 w-24 border-orange-500/30"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={saving}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Camera size={16} />
                  Change Photo
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              <div className="mt-6 space-y-3 text-sm">
                <div className="flex items-center gap-2 text-white/60">
                  <Mail size={15} />
                  <span className="truncate">{profile.email ?? user.email}</span>
                </div>
                <div className="flex items-center gap-2 text-white/60">
                  <UserRound size={15} />
                  <span className="capitalize">
                    {String(profile.primary_role ?? "user").replaceAll("_", " ")}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#050505] p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-white">
                    Username / display name
                  </span>
                  <input
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none transition focus:border-orange-500"
                    placeholder="Your name"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-white">
                    Handle
                  </span>
                  <input
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none transition focus:border-orange-500"
                    placeholder="optional handle"
                  />
                </label>
              </div>

              {error ? (
                <p className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {error}
                </p>
              ) : null}
              {message ? (
                <p className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                  {message}
                </p>
              ) : null}

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Save Profile
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
