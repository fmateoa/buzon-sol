import { useState, type ReactNode } from "react";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import type { BuzonAdapter } from "@/domain/adapter";
import { AdapterProvider } from "./adapter-context";
import { createQueryClient } from "./query-client";

export const AppProviders = ({ adapter, client, children }: { adapter: BuzonAdapter; client?: QueryClient; children: ReactNode }) => {
	const [queryClient] = useState(() => client ?? createQueryClient());
	return (
		<AdapterProvider adapter={adapter}>
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		</AdapterProvider>
	);
};
