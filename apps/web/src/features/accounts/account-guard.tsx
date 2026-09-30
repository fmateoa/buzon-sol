import { useEffect } from "react";
import { Outlet, useMatch, useNavigate, useParams } from "react-router";
import { Button } from "lizaui/button";
import type { AccountId, VisibleAccount } from "@/domain/types";
import { EmptyState } from "@/components/custom/layout-bits";
import { useAppSession, useSession } from "@/features/session/use-session";

const LAST_ACCOUNT_KEY = "buzon-sol:last-account";

/** Preferencia local del visor (no es estado de servidor). */
export const rememberAccount = (accountId: AccountId) => {
	try {
		window.localStorage.setItem(LAST_ACCOUNT_KEY, accountId);
	} catch {
		/* sin almacenamiento disponible */
	}
};

export const lastAccount = (): AccountId | null => {
	try {
		return window.localStorage.getItem(LAST_ACCOUNT_KEY) as AccountId | null;
	} catch {
		return null;
	}
};

/** ID de la cuenta activa según la ruta (`/c/:accountId/...`). */
export const useRouteAccountId = (): AccountId | null => {
	const match = useMatch("/c/:accountId/*");
	return (match?.params.accountId as AccountId | undefined) ?? null;
};

export const useAccountId = (): AccountId => {
	const { accountId } = useParams();
	if (!accountId) throw new Error("useAccountId fuera de /c/:accountId");
	return accountId as AccountId;
};

/** Cuenta visible activa. Solo existe dentro de `AccountGuard`. */
export const useActiveAccount = (): VisibleAccount => {
	const session = useAppSession();
	const accountId = useAccountId();
	const account = session.visibleAccounts.find((a) => a.id === accountId);
	if (!account) throw new Error("Cuenta no visible");
	return account;
};

/** Cuenta preferida para entrar: la última usada si sigue visible, o la primera. */
export const preferredAccount = (accounts: VisibleAccount[]): VisibleAccount | undefined => {
	const last = lastAccount();
	return accounts.find((a) => a.id === last) ?? accounts[0];
};

export const NoAccountAccess = () => {
	const navigate = useNavigate();
	const { data } = useSession();
	const fallback = data ? preferredAccount(data.visibleAccounts) : undefined;
	return (
		<div className="mx-auto max-w-xl py-10">
			<EmptyState
				icon="!"
				title="No tiene acceso a esta cuenta"
				action={
					<Button color="primary" onClick={() => navigate(fallback ? `/c/${fallback.id}/resumen` : "/", { replace: true })}>
						Volver al resumen
					</Button>
				}
			>
				Su rol no incluye esta cuenta SUNAT. Consulte con el administrador.
			</EmptyState>
		</div>
	);
};

/**
 * Guarda de cuenta: la ruta se valida contra las cuentas de la sesión ANTES de pedir datos.
 * El `key` del Outlet desmonta la vista al cambiar de cuenta: filtros, selección y estado
 * transitorio de la cuenta anterior se descartan.
 */
export const AccountGuard = () => {
	const session = useAppSession();
	const accountId = useAccountId();
	const visible = session.visibleAccounts.some((a) => a.id === accountId);

	useEffect(() => {
		if (visible) rememberAccount(accountId);
	}, [visible, accountId]);

	if (!visible) return <NoAccountAccess />;
	return <Outlet key={accountId} />;
};
