import { Activity, Bell, Building2, CalendarClock, LayoutDashboard, Mail, ScrollText, Settings, ShieldCheck, UserRound, Users, type LucideIcon } from "lucide-react";
import type { AccountId, Permission } from "@/domain/types";

export interface NavItem {
	key: string;
	label: string;
	icon: LucideIcon;
	to: string;
	/** Permiso requerido; sin él el enlace no se muestra (el servidor también lo niega). */
	permission?: Permission;
	count?: "messages" | "notifications";
}

export const accountNav = (accountId: AccountId): NavItem[] => [
	{ key: "resumen", label: "Resumen", icon: LayoutDashboard, to: `/c/${accountId}/resumen` },
	{ key: "mensajes", label: "Mensajes", icon: Mail, to: `/c/${accountId}/mensajes`, count: "messages" },
	{ key: "notificaciones", label: "Notificaciones", icon: Bell, to: `/c/${accountId}/notificaciones`, count: "notifications" },
	{ key: "actividad", label: "Actividad", icon: Activity, to: `/c/${accountId}/actividad` },
];

export const personalNav: NavItem[] = [{ key: "perfil", label: "Perfil", icon: UserRound, to: "/perfil" }];

export const adminNav: NavItem[] = [
	{ key: "cuentas", label: "Cuentas SUNAT", icon: Building2, to: "/admin/cuentas", permission: "manage_accounts" },
	{ key: "usuarios", label: "Usuarios", icon: Users, to: "/admin/usuarios", permission: "manage_users_roles" },
	{ key: "roles", label: "Roles y permisos", icon: ShieldCheck, to: "/admin/roles", permission: "manage_users_roles" },
	{ key: "programada", label: "Actividad programada", icon: CalendarClock, to: "/admin/actividad", permission: "manage_accounts" },
	{ key: "configuraciones", label: "Configuraciones", icon: Settings, to: "/admin/configuraciones", permission: "manage_settings" },
	{ key: "auditoria", label: "Auditoría", icon: ScrollText, to: "/admin/auditoria", permission: "view_audit" },
];
