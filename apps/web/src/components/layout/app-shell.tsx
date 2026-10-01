import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { Button } from "lizaui/button";
import { ChevronsLeft, ChevronsRight, LogOut, Mail, Menu, Moon, Sun } from "lucide-react";
import type { AccountId, MailBox } from "@/domain/types";
import { cn } from "@/lib/cn";
import { can } from "@/lib/permissions";
import { formatCount } from "@/lib/format";
import { useTheme } from "@/lib/theme";
import { describeConnection, tagColor, TONE_TEXT } from "@/components/custom/status";
import { AccountSelector } from "@/features/accounts/account-selector";
import { preferredAccount, useRouteAccountId } from "@/features/accounts/account-guard";
import { useFolders, useSummary, useTags } from "@/features/accounts/queries";
import { useAppSession, useLogout } from "@/features/session/use-session";
import { useIsDesktop, useIsMobile } from "@/hooks/use-media-query";
import { accountNav, adminNav, personalNav, type NavItem } from "./nav-items";

const SectionLabel = ({ children }: { children: string }) => <p className="px-2.5 text-[11px] font-semibold tracking-[0.08em] text-subtle-ink uppercase">{children}</p>;

const useUnreadCounts = (accountId: AccountId | null) => {
	const summary = useSummary(accountId ?? ("" as AccountId), accountId !== null);
	if (!accountId || !summary.data || summary.data.accountId !== accountId) return null;
	return { messages: summary.data.boxes.messages.unreadInSunat, notifications: summary.data.boxes.notifications.unreadInSunat };
};

/** Cambio rápido claro/oscuro. La preferencia completa (incluido «Sistema») está en Perfil. */
const ThemeToggle = () => {
	const { resolved, setPreference } = useTheme();
	const next = resolved === "dark" ? "light" : "dark";
	return (
		<Button size="sm" variant="light" isIconOnly aria-label={next === "dark" ? "Usar tema oscuro" : "Usar tema claro"} onClick={() => setPreference(next)} className="size-11 min-w-11">
			{next === "dark" ? <Moon className="size-4" aria-hidden="true" /> : <Sun className="size-4" aria-hidden="true" />}
		</Button>
	);
};

const NavEntry = ({ item, count, variant }: { item: NavItem; count?: number | undefined; variant: "full" | "rail" }) => (
	<NavLink
		to={item.to}
		end={false}
		className={({ isActive }) =>
			cn(
				"flex items-center rounded-md text-sm transition-colors",
				variant === "full" ? "min-h-10 justify-between gap-2 px-2.5 py-2" : "size-11 justify-center",
				isActive ? "bg-paper font-semibold text-brand shadow-[inset_0_0_0_1px_var(--bz-brand-line)]" : "text-ink-2 hover:bg-paper/70",
			)
		}
		aria-label={variant === "rail" ? `${item.label}${count ? `, ${count} no leídos` : ""}` : undefined}
	>
		{variant === "full" ? (
			<>
				<span className="flex items-center gap-2.5">
					<item.icon className="size-4 shrink-0" aria-hidden="true" />
					{item.label}
				</span>
				{count ? (
					<span className="mono text-xs text-muted-ink">
						{formatCount(count)}
						<span className="sr-only"> no leídos</span>
					</span>
				) : null}
			</>
		) : (
			<span className="relative">
				<item.icon className="size-5" aria-hidden="true" />
				{count ? <span aria-hidden="true" className="absolute -top-1.5 -right-2 rounded-full bg-brand-fill px-1 text-[10px] leading-4 font-semibold text-white">{count}</span> : null}
			</span>
		)}
	</NavLink>
);

const FolderAndTagLinks = ({ accountId, box }: { accountId: AccountId; box: MailBox }) => {
	const folders = useFolders(accountId, box);
	const tags = useTags(accountId);
	const base = `/c/${accountId}/${box === "messages" ? "mensajes" : "notificaciones"}`;
	return (
		<>
			<div className="flex flex-col gap-1">
				<SectionLabel>Carpetas</SectionLabel>
				{folders.data && folders.data.length === 0 && <p className="px-2.5 text-[13px] text-subtle-ink">Esta cuenta no tiene carpetas propias.</p>}
				{folders.data?.map((f) => (
					<Link key={f.code} to={`${base}?carpeta=${encodeURIComponent(f.code)}`} className="flex justify-between rounded px-2.5 py-1 text-[13px] text-ink-2 hover:bg-paper/70">
						<span>
							{f.name}
							{f.locked && <span className="sr-only"> (carpeta protegida)</span>}
						</span>
						<span className="mono text-xs text-subtle-ink">{formatCount(f.count)}</span>
					</Link>
				))}
			</div>
			<div className="flex flex-col gap-1">
				<SectionLabel>Etiquetas SUNAT</SectionLabel>
				{tags.data?.map((t) => (
					<Link key={t.code} to={`${base}?etiqueta=${encodeURIComponent(t.code)}`} className="flex items-center gap-2 rounded px-2.5 py-1 text-[13px] text-ink-2 hover:bg-paper/70" title={t.name}>
						<span aria-hidden="true" className={cn("size-2 shrink-0 rounded-[2px]", !t.known && "outline outline-1 outline-dashed outline-foreground-400")} style={{ background: tagColor(t) }} />
						<span className="truncate">{t.name}</span>
						{!t.known && <span className="sr-only"> (etiqueta nueva)</span>}
					</Link>
				))}
			</div>
		</>
	);
};

const ConnectionCard = ({ accountId }: { accountId: AccountId }) => {
	const session = useAppSession();
	const account = session.visibleAccounts.find((a) => a.id === accountId);
	if (!account) return null;
	const view = describeConnection(account.connection);
	return (
		<Link to={`/c/${accountId}/actividad`} className="flex flex-col gap-1 rounded-lg border border-line bg-paper px-3 py-2.5 hover:border-line-strong">
			<span className={cn("flex items-center gap-2 text-[13px] font-semibold", TONE_TEXT[view.tone])}>
				<span className={cn("mono", view.icon === "↻" && "inline-block motion-safe:animate-spin")} aria-hidden="true">
					{view.icon}
				</span>
				{view.label}
			</span>
			<span className="text-xs text-muted-ink">{view.sub}</span>
		</Link>
	);
};

/** Barra principal: módulos del sistema, administración y datos personales. */
const MainSidebar = ({ accountId, inMailbox, variant, onToggle }: { accountId: AccountId | null; inMailbox: boolean; variant: "full" | "rail"; onToggle?: (() => void) | undefined }) => {
	const session = useAppSession();
	const logout = useLogout();
	const admin = adminNav.filter((i) => !i.permission || can(session, i.permission));
	const full = variant === "full";
	const mailboxItem: NavItem = { key: "buzon", label: "Buzón SUNAT", icon: Mail, to: accountId ? `/c/${accountId}/resumen` : "/" };

	return (
		<nav aria-label="Navegación principal" className={cn("flex h-full flex-col gap-5 overflow-y-auto border-r border-line bg-surface", full ? "w-[232px] px-3.5 py-5" : "w-[76px] items-center px-2 py-4")}>
			<div className={cn("flex items-center", full ? "justify-between" : "flex-col gap-2")}>
				<Link to="/" className={cn("flex items-center gap-2.5", full ? "px-2" : "justify-center")} aria-label="buzon-sol, inicio">
					<span aria-hidden="true" className="size-[22px] shrink-0 rounded-[5px] bg-brand-fill" />
					{full && <span className="text-base font-bold tracking-tight text-ink">buzon-sol</span>}
				</Link>
				{onToggle && (
					<Button size="sm" variant="light" isIconOnly aria-label={full ? "Contraer barra lateral" : "Expandir barra lateral"} onClick={onToggle} className="size-8 min-w-8">
						{full ? <ChevronsLeft className="size-4" aria-hidden="true" /> : <ChevronsRight className="size-4" aria-hidden="true" />}
					</Button>
				)}
			</div>

			<div className="flex flex-col gap-0.5">
				{full && <SectionLabel>Módulos</SectionLabel>}
				<NavLink
					to={mailboxItem.to}
					className={cn(
						"flex items-center rounded-md text-sm transition-colors",
						full ? "min-h-10 gap-2.5 px-2.5 py-2" : "size-11 justify-center",
						inMailbox ? "bg-paper font-semibold text-brand shadow-[inset_0_0_0_1px_var(--bz-brand-line)]" : "text-ink-2 hover:bg-paper/70",
					)}
					aria-label={full ? undefined : mailboxItem.label}
					aria-current={inMailbox ? "page" : undefined}
				>
					<mailboxItem.icon className={cn("shrink-0", full ? "size-4" : "size-5")} aria-hidden="true" />
					{full && mailboxItem.label}
				</NavLink>
			</div>

			{admin.length > 0 && (
				<div className="flex flex-col gap-0.5">
					{full && <SectionLabel>Administración</SectionLabel>}
					{!full && <span className="my-1 h-px w-8 bg-line" aria-hidden="true" />}
					{admin.map((item) => (
						<NavEntry key={item.key} item={item} variant={variant} />
					))}
				</div>
			)}

			<div className="flex-1" />
			<div className="flex flex-col gap-0.5">
				{personalNav.map((item) => (
					<NavEntry key={item.key} item={item} variant={variant} />
				))}
			</div>
			<div className={cn("flex items-center gap-2", full ? "justify-between px-1" : "flex-col")}>
				{full && (
					<span className="min-w-0 text-xs text-muted-ink">
						<span className="block truncate font-semibold text-ink-2">{session.user.name}</span>
						{session.user.roleName}
					</span>
				)}
				<div className={cn("flex shrink-0", !full && "flex-col")}>
					<ThemeToggle />
					<Button size="sm" variant="light" isIconOnly aria-label="Cerrar sesión de buzon-sol" onClick={() => logout.mutate()} className="size-11 min-w-11">
						<LogOut className="size-4" aria-hidden="true" />
					</Button>
				</div>
			</div>
		</nav>
	);
};

/** Panel propio del módulo Buzón SUNAT: cuenta, bandejas, carpetas y etiquetas. */
const MailboxSidebar = ({ accountId, box, variant }: { accountId: AccountId; box: MailBox | null; variant: "full" | "rail" }) => {
	const session = useAppSession();
	const counts = useUnreadCounts(accountId);
	const full = variant === "full";

	return (
		<nav aria-label="Buzón SUNAT" className={cn("flex h-full flex-col gap-5 overflow-y-auto border-r border-line bg-paper", full ? "w-[232px] px-3.5 py-5" : "w-[76px] items-center px-2 py-4")}>
			{full && <h2 className="px-2 text-base font-bold tracking-tight text-ink">Buzón SUNAT</h2>}

			{session.visibleAccounts.length > 0 && (
				<div className="flex flex-col gap-1">
					{full && <SectionLabel>Cuenta SUNAT</SectionLabel>}
					<AccountSelector activeId={accountId} compact={!full} />
				</div>
			)}

			<div className="flex flex-col gap-0.5">
				{accountNav(accountId).map((item) => (
					<NavEntry key={item.key} item={item} variant={variant} count={item.count && counts ? counts[item.count] : undefined} />
				))}
			</div>

			{full && box && <FolderAndTagLinks accountId={accountId} box={box} />}

			<div className="flex-1" />
			{full && <ConnectionCard accountId={accountId} />}
		</nav>
	);
};

const MobileBottomBar = ({ accountId }: { accountId: AccountId | null }) => {
	const counts = useUnreadCounts(accountId);
	const items = [
		...(accountId
			? [
					{ key: "m", label: "Mensajes", short: "Mensajes", to: `/c/${accountId}/mensajes`, count: counts?.messages },
					{ key: "n", label: "Notificaciones", short: "Notificac.", to: `/c/${accountId}/notificaciones`, count: counts?.notifications },
				]
			: []),
		{ key: "mas", label: "Más", short: "Más", to: "/mas", count: undefined },
	];
	return (
		<nav aria-label="Navegación inferior" className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-paper pb-[env(safe-area-inset-bottom)]">
			{items.map((item) => (
				<NavLink
					key={item.key}
					to={item.to}
					className={({ isActive }) => cn("flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs", isActive ? "font-semibold text-brand" : "text-ink-2")}
					aria-label={item.count ? `${item.label}, ${item.count} no leídos` : item.label}
				>
					{item.key === "mas" ? <Menu className="size-5" aria-hidden="true" /> : null}
					<span aria-hidden="true">{item.short}</span>
					{item.count ? (
						<span aria-hidden="true" className="mono text-[11px] text-brand">
							● {item.count}
						</span>
					) : null}
				</NavLink>
			))}
		</nav>
	);
};

/** Cabecera móvil: cuenta activa y estado de su consulta (M1/M4). */
const MobileHeader = ({ accountId }: { accountId: AccountId | null }) => {
	const session = useAppSession();
	const account = session.visibleAccounts.find((a) => a.id === accountId);
	const view = account ? describeConnection(account.connection) : null;
	return (
		<header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-paper/95 px-4 py-2 backdrop-blur">
			<span aria-hidden="true" className="size-5 shrink-0 rounded-[5px] bg-brand-fill" />
			<div className="min-w-0 flex-1">
				<p className="truncate text-sm font-semibold text-ink">{account?.alias ?? "buzon-sol"}</p>
				{view && (
					<p className={cn("truncate text-xs", TONE_TEXT[view.tone])}>
						<span aria-hidden="true">{view.icon} </span>
						{view.label}
					</p>
				)}
			</div>
			{session.visibleAccounts.length > 1 && <AccountSelector activeId={accountId} compact />}
		</header>
	);
};

const boxFromPath = (pathname: string): MailBox | null => {
	const section = pathname.split("/")[3];
	if (section === "mensajes") return "messages";
	if (section === "notificaciones") return "notifications";
	return null;
};

export const AppShell = () => {
	const session = useAppSession();
	const routeAccountId = useRouteAccountId();
	// Fuera de una ruta de cuenta (perfil, administración) la navegación usa la última cuenta.
	const accountId = routeAccountId ?? preferredAccount(session.visibleAccounts)?.id ?? null;
	const { pathname } = useLocation();
	const box = routeAccountId ? (boxFromPath(pathname) ?? "messages") : null;
	const isDesktop = useIsDesktop();
	const isMobile = useIsMobile();
	const [collapsed, setCollapsed] = useState(false);
	const mainVariant = isDesktop && !collapsed ? "full" : "rail";
	const panelVariant = isDesktop ? "full" : "rail";

	// Diseño: barra principal gris (`bg-surface`), panel del módulo y contenido en tarjeta blanca.
	return (
		<div className="flex min-h-dvh bg-surface">
			<a href="#contenido" className="sr-only z-50 rounded bg-paper px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
				Saltar al contenido
			</a>
			{!isMobile && (
				<aside className="sticky top-0 flex h-dvh shrink-0">
					<MainSidebar accountId={accountId} inMailbox={routeAccountId !== null} variant={mainVariant} onToggle={isDesktop ? () => setCollapsed((c) => !c) : undefined} />
					{routeAccountId && <MailboxSidebar accountId={routeAccountId} box={box} variant={panelVariant} />}
				</aside>
			)}
			<div className="flex min-w-0 flex-1 flex-col bg-paper">
				{isMobile && <MobileHeader accountId={accountId} />}
				<main id="contenido" tabIndex={-1} className="min-w-0 flex-1 px-4 pt-4 pb-24 outline-none md:px-8 md:pt-7 md:pb-10">
					<div className="mx-auto max-w-[1040px]">
						<Outlet />
					</div>
				</main>
			</div>
			{isMobile && <MobileBottomBar accountId={accountId} />}
		</div>
	);
};
