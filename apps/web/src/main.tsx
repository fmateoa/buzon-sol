import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import { HttpAdapter } from "@/adapters/http/http-adapter";
import { LocalAdapter } from "@/adapters/local/local-adapter";
import { AppProviders } from "@/app/providers";
import { routes } from "@/app/routes";
import { applyTheme, watchTheme } from "@/lib/theme";
import "./index.css";

/**
 * Fuente de datos: la API (`VITE_DATA_SOURCE=backend` en `.env`) o el adaptador local con datos
 * ficticios (modo `prototype`). Ambos implementan `BuzonAdapter`; las pantallas no cambian.
 */
const adapter = import.meta.env.VITE_DATA_SOURCE === "backend" ? new HttpAdapter() : new LocalAdapter();
const router = createBrowserRouter(routes);

// Tema claro/oscuro: preferencia del visor o del sistema operativo.
applyTheme();
watchTheme();

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<AppProviders adapter={adapter}>
			<RouterProvider router={router} />
		</AppProviders>
	</StrictMode>,
);
