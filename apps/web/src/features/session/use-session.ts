import { createContext, useContext } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { useAdapter } from "@/app/adapter-context";
import { qk } from "@/app/query-keys";
import type { AppSession, Permission } from "@/domain/types";
import { can } from "@/lib/permissions";

export const useSession = () => {
	const adapter = useAdapter();
	return useQuery({
		queryKey: qk.session,
		queryFn: () => adapter.getSession(),
		// Se revalida a menudo: un cambio de rol o de acceso aplica sin nuevo login.
		staleTime: 10_000,
		refetchInterval: 30_000,
	});
};

/**
 * Sesión garantizada: la provee `RequireSession`. Al cerrar sesión, los componentes que
 * aún no se desmontaron leen el último valor en vez de fallar mientras se redirige.
 */
export const AppSessionContext = createContext<AppSession | null>(null);

export const useAppSession = (): AppSession => {
	const session = useContext(AppSessionContext);
	if (!session) throw new Error("useAppSession fuera de una ruta protegida");
	return session;
};

export const useCan = (permission: Permission) => can(useSession().data, permission);

export const useLogin = () => {
	const adapter = useAdapter();
	const client = useQueryClient();
	return useMutation({
		mutationFn: async ({ email, password }: { email: string; password: string }) => {
			const result = await adapter.login(email, password);
			if (!result.ok) throw result.error;
			return result.data;
		},
		onSuccess: (session) => {
			client.clear();
			client.setQueryData(qk.session, session);
		},
	});
};

export const useLogout = () => {
	const adapter = useAdapter();
	const client = useQueryClient();
	const navigate = useNavigate();
	return useMutation({
		mutationFn: () => adapter.logout(),
		onSuccess: () => {
			// Sin «volver a»: el siguiente usuario no debe aterrizar en la ruta del anterior.
			navigate("/login", { replace: true });
			client.setQueryData(qk.session, null);
			// Se descartan los datos del usuario anterior; la sesión queda en null.
			client.removeQueries({ predicate: (query) => query.queryKey[0] !== qk.session[0] });
		},
	});
};

export const useSetReadWarning = () => {
	const adapter = useAdapter();
	const client = useQueryClient();
	return useMutation({
		mutationFn: async (enabled: boolean) => {
			const result = await adapter.setReadWarning(enabled);
			if (!result.ok) throw result.error;
			return result.data;
		},
		onSuccess: (session) => client.setQueryData(qk.session, session),
	});
};
