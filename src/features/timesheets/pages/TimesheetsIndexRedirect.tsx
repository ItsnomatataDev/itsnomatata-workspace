import { Navigate } from "react-router-dom";
import { useAuth } from "../../../app/providers/AuthProvider";

/**
 * Resolves bare /timesheets to personal time entries (timer + manual time).
 */
export default function TimesheetsIndexRedirect() {
  const auth = useAuth();

  if (!auth || auth.loading) {
    return (
      <div className="min-h-screen bg-black p-6 text-white">
        Loading timesheets...
      </div>
    );
  }

  return <Navigate to="/time-entries" replace />;
}
