import { Navigate, useParams } from "react-router-dom";

/** Old schedule links used /client-review/:token; they now map to internal preview. */
export default function ClientReviewLegacyRedirectPage() {
  const { token = "" } = useParams();
  if (!token) {
    return <Navigate to="/" replace />;
  }
  return <Navigate to={`/internal-preview/${token}`} replace />;
}
