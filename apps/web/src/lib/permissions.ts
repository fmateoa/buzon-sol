import type { AppSession, Permission } from "@/domain/types";

export const can = (session: AppSession | null | undefined, permission: Permission): boolean =>
	Boolean(session?.permissions.includes(permission));

export const PERMISSION_LABELS: Record<Permission, string> = {
	view_mailbox: "Ver bandejas (metadatos)",
	read_content: "Leer contenido",
	download_file: "Descargar adjuntos",
	mark_reviewed: "Marcar como revisado en buzon-sol",
	run_inventory: "Consultar ahora (inventario manual)",
	view_audit: "Ver auditoría",
	configure_schedule: "Configurar programador",
	manage_accounts: "Gestionar cuentas SUNAT y credenciales",
	manage_users_roles: "Gestionar usuarios y roles",
};

/** Permisos cuyo uso puede cambiar el estado de un elemento en SUNAT. */
export const REMOTE_EFFECT_PERMISSIONS: Permission[] = ["read_content"];
