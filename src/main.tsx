import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initOfflineDb } from "./lib/offlineDb";

initOfflineDb().then(() => {
  createRoot(document.getElementById("root")!).render(<App />);
});

