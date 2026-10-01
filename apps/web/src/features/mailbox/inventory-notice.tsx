import { Link } from "react-router";
import { Button } from "lizaui/button";
import type { AccountId, InventoryCoverage, MailBox, VisibleAccount } from "@/domain/types";
import { Notice } from "@/components/custom/notice";
import { boxLabel } from "@/components/custom/status";
import { useActivity, useResumeRun, useSummary } from "@/features/accounts/queries";
import { useAppSession, useCan } from "@/features/session/use-session";
import { errorCopy } from "@/lib/errors";
import { formatCount } from "@/lib/format";
import { can } from "@/lib/permissions";

const ActivityLink = ({ accountId, children = "Ver actividad" }: { accountId: AccountId; children?: string }) => (
	<Link to={`/c/${accountId}/actividad`} className="inline-flex min-h-9 items-center text-sm font-semibold text-brand underline">
		{children}
	</Link>
);

/** Pausa por credencial: aviso para usuarios y acceso a «Actualizar credencial» para admin. */
export const CredentialPausedNotice = ({ account }: { account: VisibleAccount }) => {
	const session = useAppSession();
	if (account.connection.pauseReason !== "invalid_credential") return null;
	return (
		<Notice
			tone="effect"
			title="Consulta en pausa"
			action={
				<>
					<ActivityLink accountId={account.id} />
					{can(session, "manage_accounts") && (
						<Link to={`/admin/cuentas/${account.id}`} className="inline-flex min-h-9 items-center text-sm font-semibold text-brand underline">
							Actualizar credencial
						</Link>
					)}
				</>
			}
		>
			SUNAT rechazó la credencial de esta cuenta y se avisó a los administradores. Puede ver el inventario guardado; abrir contenido y descargar no están disponibles.
		</Notice>
	);
};

/** Estado del barrido de una bandeja: en curso, parcial (con «Reanudar») o completo. */
export const InventoryNotice = ({ account, box, coverage }: { account: VisibleAccount; box: MailBox; coverage: InventoryCoverage }) => {
	const canRun = useCan("run_inventory");
	const activity = useActivity(account.id);
	const summary = useSummary(account.id);
	const initialLoad = Boolean(summary.data?.initialLoad.active);
	const resume = useResumeRun(account.id);
	const resumable = activity.data?.history.find((r) => r.resumeFrom?.box === box);
	const credentialPaused = account.connection.pauseReason === "invalid_credential";

	if (coverage.state === "running" || coverage.state === "pending") {
		if (initialLoad) {
			return (
				<Notice tone="partial" title="Carga inicial en curso" action={<ActivityLink accountId={account.id}>Ver progreso</ActivityLink>}>
					Estamos cargando el buzón de esta cuenta en segundo plano. Ya puede revisar lo cargado: {formatCount(coverage.uniqueCount)} registros en {boxLabel(box)} hasta ahora, empezando por los más recientes. La lista se actualiza sola.
				</Notice>
			);
		}
		return (
			<Notice tone="partial" title={coverage.state === "pending" ? "Inventario en cola" : "Inventario en curso"} action={<ActivityLink accountId={account.id}>Ver progreso</ActivityLink>}>
				Página {formatCount(coverage.pagesScanned)}
				{coverage.estimatedPages ? ` de ~${formatCount(coverage.estimatedPages)}` : ""} · {formatCount(coverage.uniqueCount)} registros únicos hasta ahora. Los resultados filtrados pueden cambiar al terminar.
			</Notice>
		);
	}
	if (coverage.state !== null && !coverage.verified) {
		return (
			<Notice
				tone="partial"
				title={`Inventario parcial de ${boxLabel(box)}`}
				action={
					resumable && canRun && !credentialPaused ? (
						<Button size="sm" color="primary" onClick={() => resume.mutate(resumable.id)} isLoading={resume.isPending} disabled={resume.isPending}>
							Reanudar
						</Button>
					) : (
						<ActivityLink accountId={account.id} />
					)
				}
			>
				Se revisaron {formatCount(coverage.pagesScanned)}
				{coverage.estimatedPages ? ` de ~${formatCount(coverage.estimatedPages)}` : ""} páginas. Los filtros solo incluyen lo ya inventariado.
				{resume.isError && <span className="block text-err">{errorCopy(resume.error).title}. {errorCopy(resume.error).body}</span>}
			</Notice>
		);
	}
	return null;
};
