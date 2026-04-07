import { NotificationProvider } from "./app/providers/NotificationProvider";
import AppRouter from "./app/router/AppRouter";
import { AuthProvider, useAuth } from "./app/providers/AuthProvider";

function AppContent() {


  return (
    <NotificationProvider >
      <AppRouter />
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
