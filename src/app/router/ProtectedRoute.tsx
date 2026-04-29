import { Navigate } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";

function AccountGateMessage({
  title,
  message,
  tone = "amber",
}: {
  title: string;
  message: string;
  tone?: "amber" | "red" | "zinc";
}) {
  const toneClasses = {
    amber: "border-amber-500/20 bg-amber-500/10 text-amber-200",
    red: "border-red-500/20 bg-red-500/10 text-red-200",
    zinc: "border-white/10 bg-white/5 text-white/70",
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-black p-6 text-white">
      <div className={`max-w-xl rounded-3xl border p-8 ${toneClasses[tone]}`}>
        <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
          Account Access
        </p>
        <h1 className="mt-3 text-2xl font-bold text-white">{title}</h1>
        <p className="mt-3 text-sm leading-6">{message}</p>
      </div>
    </div>
  );
}

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const auth = useAuth();

  if (!auth) {
    return (
      <div className="min-h-screen bg-black p-6 text-white">
        Loading authentication...
      </div>
    );
  }

  const { user, profile, loading } = auth;

  if (loading) {
    return (
      <div className="min-h-screen bg-black p-6 text-white">
        Loading profile...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const accountStatus =
    profile?.account_status ??
    (profile?.is_suspended
      ? "suspended"
      : profile?.is_active === false
        ? "pending"
        : "active");

  if (accountStatus === "pending") {
    return (
      <AccountGateMessage
        title="Waiting for admin approval"
        message="Your account has been created, but an administrator needs to approve it before you can access the workspace."
      />
    );
  }

  if (accountStatus === "suspended") {
    return (
      <AccountGateMessage
        title="Account suspended"
        message="Your access has been paused by an administrator. Contact your organization admin if you believe this is a mistake."
        tone="red"
      />
    );
  }

  if (accountStatus === "rejected") {
    return (
      <AccountGateMessage
        title="Signup rejected"
        message="This signup request was rejected by an administrator."
        tone="red"
      />
    );
  }

  if (accountStatus === "deleted") {
    return (
      <AccountGateMessage
        title="Account removed"
        message="This account has been removed from the workspace."
        tone="zinc"
      />
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
