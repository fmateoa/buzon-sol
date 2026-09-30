import { QueryClient } from "@tanstack/react-query";
import { isAppError } from "@/lib/errors";

export const createQueryClient = () =>
	new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 15_000,
				// Un error de autorización o validación no mejora reintentando.
				retry: (count, error) => !isAppError(error, "forbidden") && !isAppError(error, "not_found") && !isAppError(error, "unauthenticated") && count < 2,
				refetchOnWindowFocus: true,
			},
			mutations: { retry: false },
		},
	});
