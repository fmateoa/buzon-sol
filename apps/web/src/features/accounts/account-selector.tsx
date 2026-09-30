import { useLocation, useNavigate } from "react-router";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "lizaui/ui";
import { Building2, ChevronDown } from "lucide-react";
import type { AccountId, VisibleAccount } from "@/domain/types";
import { describeConnection, TONE_TEXT } from "@/components/custom/status";
import { cn } from "@/lib/cn";
import { useAppSession } from "@/features/session/use-session";

const SECTIONS = ["resumen", "mensajes", "notificaciones", "actividad"];

/** Al cambiar de cuenta se conserva la sección, pero nunca el elemento ni los filtros de la anterior. */
export const useSwitchAccount = () => {
	const navigate = useNavigate();
	const { pathname } = useLocation();
	return (accountId: AccountId) => {
		const section = pathname.split("/")[3];
		navigate(`/c/${accountId}/${section && SECTIONS.includes(section) ? section : "resumen"}`);
	};
};

const newCount = (a: VisibleAccount) => a.newSinceLastRun.messages + a.newSinceLastRun.notifications;

export const AccountSelector = ({ activeId, compact = false }: { activeId: AccountId | null; compact?: boolean }) => {
	const session = useAppSession();
	const switchTo = useSwitchAccount();
	const accounts = session.visibleAccounts;
	const index = accounts.findIndex((a) => a.id === activeId);
	const active = accounts[index];

	if (accounts.length === 0) return null;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				{compact ? (
					<button type="button" className="flex size-11 items-center justify-center rounded-lg border border-line-strong bg-white text-ink-2" aria-label={`Cuenta SUNAT: ${active?.alias ?? "elegir"}. Cambiar cuenta`}>
						<Building2 className="size-5" aria-hidden="true" />
					</button>
				) : (
					<button type="button" className="flex w-full items-center gap-2 rounded-lg border-[1.5px] border-foreground-400 bg-white px-2.5 py-2 text-left" aria-label={`Cuenta SUNAT: ${active?.alias ?? "elegir"}. Cambiar cuenta`}>
						<span className="min-w-0 flex-1">
							<span className="block truncate text-[13px] font-semibold text-ink">{active?.alias ?? "Elegir cuenta"}</span>
							{active && (
								<span className="mono block text-[11px] text-muted-ink">
									RUC {active.rucMasked} · {index + 1} de {accounts.length}
								</span>
							)}
						</span>
						<ChevronDown className="size-4 shrink-0 text-muted-ink" aria-hidden="true" />
					</button>
				)}
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-80">
				<DropdownMenuLabel>Cuentas visibles para su rol ({session.user.roleName})</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuRadioGroup value={activeId ?? ""} onValueChange={(v) => switchTo(v as AccountId)}>
					{accounts.map((a) => {
						const view = describeConnection(a.connection);
						const n = newCount(a);
						return (
							<DropdownMenuRadioItem key={a.id} value={a.id} className="py-2">
								<span className="flex min-w-0 flex-1 flex-col">
									<span className="truncate font-medium text-ink">{a.alias}</span>
									<span className={cn("text-xs", TONE_TEXT[view.tone])}>
										<span aria-hidden="true">{view.icon} </span>
										{view.label}
									</span>
								</span>
								{n > 0 && <span className="ml-2 shrink-0 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand">{n} nuevos</span>}
							</DropdownMenuRadioItem>
						);
					})}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};
