
import { createRoot } from "react-dom/client";

import App from "./App";
import "./styles/index.css";
import "./styles/tailwind-compat.css";
import "./i18n/config";
import { AccessibilityProvider } from "./contexts/AccessibilityContext";
import { initializeGlobalErrorHandlers } from "./utils/errorHandlers";

// Initialize global error handling and API interception
initializeGlobalErrorHandlers();

if ("serviceWorker" in navigator && import.meta.env.DEV) {
	navigator.serviceWorker
		.getRegistrations()
		.then((registrations) => {
			if (registrations.length === 0) return;
			registrations.forEach((registration) => {
				registration.unregister();
			});
			console.info("[main] Unregistered existing service workers in dev mode.");
		})
		.catch((error) => {
			console.warn("[main] Failed to unregister service workers in dev mode:", error);
		});
}

if ("serviceWorker" in navigator && import.meta.env.PROD) {
	window.addEventListener("load", () => {
		navigator.serviceWorker
			.register("/sw.js")
			.then((registration) => {
				// Force an update check on each page load so clients move off stale SW versions faster.
				registration.update();

				registration.addEventListener("updatefound", () => {
					const newWorker = registration.installing;
					if (!newWorker) return;
					newWorker.addEventListener("statechange", () => {
						if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
							newWorker.postMessage({ type: "SKIP_WAITING" });
						}
					});
				});
			})
			.catch((error) => {
				console.error("Service worker registration failed:", error);
			});

		navigator.serviceWorker.addEventListener("controllerchange", () => {
			window.location.reload();
		});
	});
}

createRoot(document.getElementById("root")!).render(
	<AccessibilityProvider>
		<App />
	</AccessibilityProvider>
);
