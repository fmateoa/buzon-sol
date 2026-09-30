import { Link } from "react-router";
import { Button } from "lizaui/button";
import { Meta, PageHeader, Section } from "@/components/custom/layout-bits";
import { Notice } from "@/components/custom/notice";
import { Segmented } from "@/components/custom/segmented";
import { ConnectionBadge } from "@/components/custom/status";
import { useAppSession, useSetReadWarning } from "@/features/session/use-session";
import { errorCopy } from "@/lib/errors";
import { formatRelative } from "@/lib/format";
import { PERMISSION_LABELS } from "@/lib/permissions";
import { useTheme, type ThemePreference } from "@/lib/theme";

const THEMES: { value: ThemePreference; label: string }[] = [
	{ value: "system", label: "Sistema" },
	{ value: "light", label: "Claro" },
	{ value: "dark", label: "Oscuro" },
];

/** D10 · Perfil y preferencias. */
export const ProfilePage = () => {
	const session = useAppSession();
	const setWarning = useSetReadWarning();
	const { user, preferences } = session;
	const theme = useTheme();

	return (
		<div className="flex flex-col gap-5">
			<PageHeader title="Perfil y preferencias" />

			<Section title="Cuenta en buzon-sol">
				<dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<Meta label="Nombre">{user.name}</Meta>
					<Meta label="Correo">{user.email}</Meta>
					<Meta label="Rol">{user.roleName}</Meta>
					<Meta label="Última actividad">{formatRelative(user.lastActivityAt)}</Meta>
				</dl>
				<div className="mt-4">
					<p className="text-xs text-muted-ink">Permisos de su rol</p>
					<ul className="mt-1 flex flex-wrap gap-1.5">
						{session.permissions.map((p) => (
							<li key={p} className="rounded-sm border border-line bg-surface px-2 py-0.5 text-xs text-ink-2">
								{PERMISSION_LABELS[p]}
							</li>
						))}
					</ul>
				</div>
			</Section>

			<Section title="Cuentas SUNAT visibles para su rol">
				{session.visibleAccounts.length === 0 ? (
					<p className="text-sm text-muted-ink">Su rol no incluye ninguna cuenta. Consulte con el administrador.</p>
				) : (
					<ul className="divide-y divide-line">
						{session.visibleAccounts.map((a) => (
							<li key={a.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
								<Link to={`/c/${a.id}/resumen`} className="font-medium text-ink underline-offset-2 hover:underline">
									{a.alias}
								</Link>
								<ConnectionBadge connection={a.connection} />
							</li>
						))}
					</ul>
				)}
			</Section>

			<Section title="Preferencias">
				<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
					<div className="max-w-xl">
						<p className="font-medium text-ink">Aviso antes de abrir un no leído</p>
						<p className="mt-1 text-sm text-muted-ink" aria-live="polite">
							{preferences.readWarningEnabled
								? "Activado. Antes de abrir por primera vez un no leído se muestra qué cambia en SUNAT y que no se puede revertir."
								: `Desactivado por usted${preferences.readWarningChangedAt ? ` ${formatRelative(preferences.readWarningChangedAt)}` : ""}. Los no leídos siguen marcados con ● y la acción «Abrir» sigue mostrando «! Puede marcar como leído».`}
						</p>
						<p className="mt-1 text-xs text-muted-ink">El cambio queda registrado en auditoría.</p>
					</div>
					<Button
						variant={preferences.readWarningEnabled ? "bordered" : "solid"}
						color="primary"
						onClick={() => setWarning.mutate(!preferences.readWarningEnabled)}
						isLoading={setWarning.isPending}
						disabled={setWarning.isPending}
						className="min-h-11 shrink-0"
					>
						{preferences.readWarningEnabled ? "Desactivar aviso" : "Volver a activar"}
					</Button>
				</div>
				{setWarning.isError && (
					<Notice tone="error" role="alert" className="mt-3" title={errorCopy(setWarning.error).title}>
						{errorCopy(setWarning.error).body}
					</Notice>
				)}
				<div className="mt-5 flex flex-col gap-2 border-t border-line pt-5">
					<Segmented legend="Tema" name="theme" options={THEMES} value={theme.preference} onChange={theme.setPreference} />
					<p className="text-sm text-muted-ink">
						{theme.preference === "system" ? `Sigue la configuración de su equipo (ahora: ${theme.resolved === "dark" ? "oscuro" : "claro"}).` : "Se guarda solo en este navegador."}
					</p>
				</div>
			</Section>
		</div>
	);
};
