import { useEffect, type ReactNode } from "react";
import { Link, Navigate, Outlet, useLocation } from "react-router";
import { Button } from "lizaui/button";
import type { Permission } from "@/domain/types";
import { EmptyState, BlockSkeleton } from "@/components/custom/layout-bits";
import { QueryError } from "@/components/custom/query-error";
import { useAdapter } from "@/app/adapter-context";
import { preferredAccount } from "@/features/accounts/account-guard";
import { can } from "@/lib/permissions";
import { AppSessionContext, useLogout, useSession } from "./use-session";

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
/** Mínimo entre avisos: el servidor igual descarta los que llegan con la sesión recién renovada. */
const ACTIVITY_PING_MS = 60_000;

/**
 * Avisa al servidor cuando la persona usa la app. Los sondeos en segundo plano no cuentan: con la
 * pestaña abierta pero sin uso, la sesión vence por inactividad.
 */
const SessionActivity = () => {
	const adapter = useAdapter();
	useEffect(() => {
		let last = 0;
		const ping = () => {
			const now = Date.now();
			if (now - last < ACTIVITY_PING_MS) return;
			last = now;
			void adapter.touchSession();
		};
		for (const name of ACTIVITY_EVENTS) window.addEventListener(name, ping, { passive: true });
		return () => {
			for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, ping);
		};
	}, [adapter]);
	return null;
};

/** Rutas con sesión de app. Sin sesión → login, recordando a dónde volver. */
export const RequireSession = () => {
	const session = useSession();
	const location = useLocation();
	if (session.isPending) {
		return (
			<div className="mx-auto max-w-md p-10">
				<BlockSkeleton label="Comprobando su sesión" />
			</div>
		);
	}
	if (session.isError) {
		return (
			<div className="mx-auto max-w-md p-10">
				<QueryError error={session.error} onRetry={() => void session.refetch()} />
			</div>
		);
	}
	if (!session.data) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
	return (
		<AppSessionContext.Provider value={session.data}>
			<SessionActivity />
			<Outlet />
		</AppSessionContext.Provider>
	);
};

/** Oculta la vista si falta el permiso. El servidor también lo niega. */
export const RequirePermission = ({ permission, children }: { permission: Permission; children: ReactNode }) => {
	const { data } = useSession();
	if (!can(data, permission)) {
		return (
			<EmptyState icon="!" title="No tiene permiso para ver esta sección" action={<Link to="/" className="text-sm font-semibold text-brand underline">Volver al inicio</Link>}>
				Su rol no incluye esta función. Consulte con el administrador.
			</EmptyState>
		);
	}
	return children;
};

/** `/` → última cuenta usada o la primera visible; sin cuentas, estado vacío. */
export const HomeRedirect = () => {
	const { data } = useSession();
	const logout = useLogout();
	const account = data ? preferredAccount(data.visibleAccounts) : undefined;
	if (account) return <Navigate to={`/c/${account.id}/resumen`} replace />;
	return (
		<div className="mx-auto max-w-xl py-10">
			<EmptyState
				title="Aún no tiene cuentas SUNAT asignadas"
				action={
					can(data, "manage_accounts") ? (
						<Link to="/admin/cuentas" className="text-sm font-semibold text-brand underline">
							Ir a Cuentas SUNAT
						</Link>
					) : (
						<Button variant="bordered" onClick={() => logout.mutate()}>
							Cerrar sesión
						</Button>
					)
				}
			>
				Su rol no incluye ninguna cuenta. Consulte con el administrador.
			</EmptyState>
		</div>
	);
};

export const NotFoundPage = () => (
	<div className="mx-auto max-w-xl py-10">
		<EmptyState title="No encontramos esta página" action={<Link to="/" className="text-sm font-semibold text-brand underline">Volver al inicio</Link>}>
			La dirección no existe o cambió.
		</EmptyState>
	</div>
);
