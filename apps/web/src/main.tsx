import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import { LocalAdapter } from "@/adapters/local/local-adapter";
import { AppProviders } from "@/app/providers";
import { routes } from "@/app/routes";
import "./index.css";

/**
 * Fuente de datos: adaptador local con datos ficticios. El cliente del backend se
 * conectará en la fase de integración implementando la misma interfaz `BuzonAdapter`.
 */
const adapter = new LocalAdapter();
const router = createBrowserRouter(routes);

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<AppProviders adapter={adapter}>
			<RouterProvider router={router} />
		</AppProviders>
	</StrictMode>,
);
