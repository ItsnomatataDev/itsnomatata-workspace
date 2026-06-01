import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import "@livekit/components-styles";
import { ensureServiceWorkerReady } from "./features/notifications/services/pushService";

void ensureServiceWorkerReady().catch((err) => {
  console.warn("SERVICE WORKER BOOTSTRAP:", err);
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
