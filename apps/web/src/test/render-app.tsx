import { render } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router";
import { LocalAdapter } from "@/adapters/local/local-adapter";
import { AppProviders } from "@/app/providers";
import { routes } from "@/app/routes";

export const EMAILS = {
	admin: "admin@empresa-demo.test",
	supervisor: "usuario1@empresa-demo.test",
	analystNoWarning: "usuario2@empresa-demo.test",
	analyst: "usuario3@empresa-demo.test",
	readonly: "usuario6@empresa-demo.test",
} as const;

/** Monta la app completa con el adaptador local sin latencia y un usuario con sesión. */
export const renderApp = (path: string, email: string | null = EMAILS.supervisor) => {
	const adapter = new LocalAdapter({ latencyMs: 0, tickMs: 5, confirmDelayMs: 30, storage: null, ...(email ? { initialUserEmail: email } : {}) });
	const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0, refetchOnWindowFocus: false }, mutations: { retry: false } } });
	const router = createMemoryRouter(routes, { initialEntries: [path] });
	const utils = render(
		<AppProviders adapter={adapter} client={client}>
			<RouterProvider router={router} />
		</AppProviders>,
	);
	return { ...utils, adapter, router, client };
};
