import { Navigate } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";

type RoleRouteProps = {
  children: React.ReactNode;
  roles: string[];
};

export default function RoleRoute({ children, roles }: RoleRouteProps) {
  const auth = useAuth();

  if (!auth || auth.loading) {
    return (
      <div className="min-h-screen bg-black p-6 text-white">
        Checking access...
      </div>
    );
  }

  const role = auth.profile?.primary_role;

  if (!auth.user) {
    return <Navigate to="/login" replace />;
  }

  if (!role || !roles.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
