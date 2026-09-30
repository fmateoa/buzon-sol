import type { ReactNode } from "react";
import { Link, Navigate, Outlet, useLocation } from "react-router";
import { Button } from "lizaui/button";
import type { Permission } from "@/domain/types";
import { EmptyState, BlockSkeleton } from "@/components/custom/layout-bits";
import { QueryError } from "@/components/custom/query-error";
import { preferredAccount } from "@/features/accounts/account-guard";
import { can } from "@/lib/permissions";
import { AppSessionContext, useLogout, useSession } from "./use-session";

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
