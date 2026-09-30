import { Link } from "react-router";
import { Button } from "lizaui/button";
import { ChevronRight } from "lucide-react";
import { accountNav, adminNav, personalNav, type NavItem } from "@/components/layout/nav-items";
import { PageHeader } from "@/components/custom/layout-bits";
import { ConnectionBadge } from "@/components/custom/status";
import { AccountSelector } from "@/features/accounts/account-selector";
import { preferredAccount } from "@/features/accounts/account-guard";
import { can } from "@/lib/permissions";
import { useAppSession, useLogout } from "./use-session";

const LinkList = ({ title, items }: { title: string; items: NavItem[] }) => (
	<section aria-label={title} className="rounded-lg border border-line bg-white">
		<h2 className="px-4 pt-3 pb-1 text-[11px] font-semibold tracking-[0.08em] text-subtle-ink uppercase">{title}</h2>
		<ul>
			{items.map((item) => (
				<li key={item.key} className="border-t border-line first:border-t-0">
					<Link to={item.to} className="flex min-h-12 items-center gap-3 px-4 text-sm text-ink">
						<item.icon className="size-5 text-muted-ink" aria-hidden="true" />
						<span className="flex-1">{item.label}</span>
						<ChevronRight className="size-4 text-muted-ink" aria-hidden="true" />
					</Link>
				</li>
			))}
		</ul>
	</section>
);

/** «Más» (móvil): resumen, actividad, perfil y administración según permiso. */
export const MorePage = () => {
	const session = useAppSession();
	const logout = useLogout();
	const account = preferredAccount(session.visibleAccounts);
	const admin = adminNav.filter((i) => !i.permission || can(session, i.permission));
	return (
		<div className="flex flex-col gap-4">
			<PageHeader title="Más" description={`${session.user.name} · ${session.user.roleName}`} />
			{account && (
				<section aria-label="Cuenta SUNAT" className="flex flex-col gap-2 rounded-lg border border-line bg-white p-4">
					<AccountSelector activeId={account.id} />
					<ConnectionBadge connection={account.connection} withSub />
				</section>
			)}
			{account && <LinkList title="Cuenta" items={accountNav(account.id).filter((i) => i.key === "resumen" || i.key === "actividad")} />}
			<LinkList title="Personal" items={personalNav} />
			{admin.length > 0 && <LinkList title="Administración" items={admin} />}
			<Button variant="bordered" size="lg" onClick={() => logout.mutate()}>
				Cerrar sesión
			</Button>
		</div>
	);
};
