import { NotificationProvider } from "./app/providers/NotificationProvider";
import AppRouter from "./app/router/AppRouter";
import { AuthProvider, useAuth } from "./app/providers/AuthProvider";
import { OrganizationBrandingProvider } from "./app/providers/OrganizationBrandingProvider";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function AppContent() {
  const auth = useAuth();
  const userId = auth?.user?.id ?? null;
  const organizationId = auth?.profile?.organization_id ?? null;

  return (
    <OrganizationBrandingProvider>
      <NotificationProvider userId={userId} organizationId={organizationId}>
        <AppRouter />
        <ToastContainer
          position="top-right"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="dark"
        />
      </NotificationProvider>
    </OrganizationBrandingProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
