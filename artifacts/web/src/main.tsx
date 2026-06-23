import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@workspace/api-client-react";
import { applyStoredTheme } from "@/components/theme";

applyStoredTheme();

const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
if (apiUrl) {
  setBaseUrl(apiUrl);
}

// After a redeploy, a lazily-imported chunk can 404 (its hashed name changed).
// Vite fires `vite:preloadError`; reload once to pull fresh assets instead of
// leaving a blank screen. Guarded so it can never loop.
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  if (!sessionStorage.getItem("spay:preloadReloaded")) {
    sessionStorage.setItem("spay:preloadReloaded", "1");
    window.location.reload();
  }
});
window.addEventListener("load", () => sessionStorage.removeItem("spay:preloadReloaded"));

createRoot(document.getElementById("root")!).render(<App />);
