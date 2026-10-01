import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { Tabs, TabsContent } from "lizaui/ui";
import { ArrowLeft } from "lucide-react";
import type { AccountId } from "@/domain/types";
import { BlockSkeleton, PageHeader, Section } from "@/components/custom/layout-bits";
import { QueryError } from "@/components/custom/query-error";
import { ConnectionBadge } from "@/components/custom/status";
import { UnderlineTabsList, UnderlineTabsTrigger } from "@/components/custom/underline-tabs";
import { formatRelative } from "@/lib/format";
import { AccountActiveControl, AccountForm, TestConnectionControl } from "./account-form";
import { ArchiveSettings } from "./archive-settings";
import { useAccountUsers, useAdminAccount } from "./queries";
import { ScheduleEditor } from "./schedule-form";

const TABS = ["datos", "programador", "archivo", "usuarios"] as const;
type Tab = (typeof TABS)[number];

const AccountUsers = ({ accountId }: { accountId: AccountId }) => {
	const users = useAccountUsers(accountId);
	if (users.isPending) return <BlockSkeleton lines={3} label="Cargando usuarios" />;
	if (users.isError) return <QueryError error={users.error} onRetry={() => void users.refetch()} />;
	return (
		<Section title="Usuarios con acceso" actions={<Link to="/admin/roles" className="text-sm font-semibold text-brand">Editar roles →</Link>}>
			<p className="mb-3 text-sm text-muted-ink">El acceso se asigna en el rol. Para quitar o dar acceso, edite el rol o asigne otro rol al usuario.</p>
			<ul className="divide-y divide-line">
				{users.data.map((u) => (
					<li key={u.id} className="flex flex-col py-2.5 sm:flex-row sm:items-center sm:justify-between">
						<span>
							<span className="font-medium text-ink">{u.name}</span>
							<span className="block text-xs text-muted-ink">{u.email}</span>
						</span>
						<span className="text-sm text-ink-2">
							{u.roleName} · {u.status === "active" ? "Activo" : u.status === "invited" ? "Invitación enviada" : "Desactivado"}
						</span>
					</li>
				))}
			</ul>
		</Section>
	);
};

/** A2/A3 · Detalle de cuenta: datos y credencial, programador y usuarios con acceso. */
export const AccountAdminDetailPage = () => {
	const accountId = useParams().accountId as AccountId;
	const [params, setParams] = useSearchParams();
	const tab: Tab = TABS.includes(params.get("tab") as Tab) ? (params.get("tab") as Tab) : "datos";
	const account = useAdminAccount(accountId);
	// Hueco de la cabecera para «Consultar ahora» y «Guardar» del programador (diseño A3).
	const [actionsSlot, setActionsSlot] = useState<HTMLDivElement | null>(null);

	if (account.isPending) return <BlockSkeleton lines={6} label="Cargando cuenta" />;
	if (account.isError) return <QueryError error={account.error} onRetry={() => void account.refetch()} />;
	const a = account.data;

	return (
		<div className="flex flex-col gap-5">
			<PageHeader
				back={
					<Link to="/admin/cuentas" className="inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-brand">
						<ArrowLeft className="size-4" aria-hidden="true" /> Cuentas SUNAT
					</Link>
				}
				title={a.alias}
				description={
					<span className="flex flex-col gap-1">
						<span className="mono">RUC {a.rucMasked}</span>
						<ConnectionBadge connection={a.connection} withSub />
					</span>
				}
			/>
			<Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })} className="gap-0">
				{/* Reservar altura para las acciones mantiene las pestañas y el contenido en su sitio en móvil y escritorio. */}
				<div className="flex flex-col-reverse gap-3 border-b border-line-soft sm:min-h-[3.125rem] sm:flex-row sm:items-end sm:justify-between">
					<UnderlineTabsList aria-label="Secciones de la cuenta" className="overflow-x-auto">
						<UnderlineTabsTrigger value="datos">Datos y credencial</UnderlineTabsTrigger>
						<UnderlineTabsTrigger value="programador">Programador</UnderlineTabsTrigger>
						<UnderlineTabsTrigger value="archivo">Archivo</UnderlineTabsTrigger>
						<UnderlineTabsTrigger value="usuarios">Usuarios con acceso</UnderlineTabsTrigger>
					</UnderlineTabsList>
					<div ref={setActionsSlot} className="flex min-h-10 flex-wrap gap-2 sm:min-h-0 sm:pb-2.5" />
				</div>
				<TabsContent value="datos" className="mt-4 flex flex-col gap-5">
					<Section title="Datos y Clave SOL">
						<AccountForm key={a.id} mode="edit" account={a} onDone={() => void account.refetch()} onCancel={() => undefined} />
					</Section>
					<Section title="Conexión con SUNAT">
						<TestConnectionControl account={a} />
					</Section>
					<Section title="Estado de la cuenta">
						<p className="mb-3 text-sm text-muted-ink">Alta: {formatRelative(a.createdAt)}. Desactivar detiene el programador y conserva inventario y auditoría.</p>
						<div className="flex flex-wrap items-center gap-3">
							<AccountActiveControl account={a} />
						</div>
					</Section>
				</TabsContent>
				<TabsContent value="programador" className="mt-4">
					<ScheduleEditor accountId={a.id} actionsSlot={actionsSlot} />
				</TabsContent>
				<TabsContent value="archivo" className="mt-4">
					<ArchiveSettings accountId={a.id} />
				</TabsContent>
				<TabsContent value="usuarios" className="mt-4">
					<AccountUsers accountId={a.id} />
				</TabsContent>
			</Tabs>
		</div>
	);
};
