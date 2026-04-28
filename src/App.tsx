import { NotificationProvider } from "./app/providers/NotificationProvider";
import AppRouter from "./app/router/AppRouter";
import { AuthProvider, useAuth } from "./app/providers/AuthProvider";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function AppContent() {
  const auth = useAuth();
  const userId = auth?.user?.id ?? null;

  return (
    <NotificationProvider userId={userId}>
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
