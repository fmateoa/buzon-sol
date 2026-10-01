import type {
	AccountActivity,
	AccountId,
	AdminAccount,
	AppSession,
	AppUser,
	AppUserStatus,
	ArchiveStatus,
	AuditEntry,
	AuditFilters,
	BulkInventoryResult,
	FileId,
	InventoryRun,
	ItemId,
	ListRequest,
	MailBox,
	MailDetail,
	MailItemMetadata,
	MailListFilters,
	MailPage,
	MailSortColumn,
	MailboxSummary,
	MailFile,
	MailboxSettings,
	AppSetting,
	SettingValues,
	Page,
	Permission,
	RemoteReadState,
	RoleId,
	RolePermissions,
	RunId,
	ScheduleConfig,
	SunatFolder,
	SunatTag,
	UserId,
} from "./types";

/**
 * Errores semánticos que el backend deberá distinguir (backend/spec.md §3).
 * No son códigos HTTP; la traducción a UX vive en `lib/errors.ts`.
 */
export type AppErrorCode =
	| "unauthenticated"
	| "forbidden"
	| "not_found"
	| "needs_credential"
	| "invalid_credential"
	| "paused"
	| "remote_session_expired"
	| "remote_unavailable"
	| "schema_changed"
	| "incomplete_inventory"
	| "conflict_running"
	| "validation"
	/** La función existe en la interfaz pero aún no está conectada al servidor o validada con SUNAT. */
	| "pending_integration";

export class AppError extends Error {
	readonly code: AppErrorCode;
	readonly fields: Record<string, string> | undefined;

	constructor(code: AppErrorCode, message?: string, fields?: Record<string, string>) {
		super(message ?? code);
		this.name = "AppError";
		this.code = code;
		this.fields = fields;
	}
}

/** Resultado tipado de un comando. Las consultas lanzan `AppError` para TanStack Query. */
export type CommandResult<T> = { ok: true; data: T } | { ok: false; error: AppError };

export interface CredentialTestResult {
	accepted: boolean;
	/** SUNAT abrió automáticamente el primer elemento al iniciar sesión. */
	autoOpenedFirstItem: boolean;
	testedAt: string;
}

export interface AccountInput {
	alias: string;
	ruc: string;
	solUser: string;
}

export interface UserInput {
	name: string;
	email: string;
	roleId: RoleId;
	/** Contraseña inicial; solo cuando `userOnboarding` es `initial_password`. Nunca se devuelve. */
	password?: string;
}

export interface RoleInput {
	name: string;
	permissions: Permission[];
	allAccounts: boolean;
	accountIds: AccountId[];
}

export type UserSortColumn = "name" | "email" | "roleName" | "status";
export interface UserFilters {
	name: string;
	email: string;
	roleName: string;
	status: AppUserStatus | "all";
}

export type AccountSortColumn = "alias" | "credential" | "lastRun";
export interface AccountFilters {
	alias: string;
	credential: "all" | "valid" | "rejected" | "missing" | "untested";
	schedule: "all" | "active" | "paused" | "disabled";
}

export type RoleSortColumn = "name" | "userCount";
export interface RoleFilters {
	name: string;
}

export type AuditSortColumn = "at" | "actor";

/**
 * Frontera de datos del frontend. El adaptador local la implementa con datos
 * ficticios; un cliente del backend la implementará después sin cambiar pantallas.
 *
 * Reglas que toda implementación debe respetar:
 * - Toda operación con cuenta verifica permiso Y pertenencia de la cuenta.
 * - Ninguna consulta de listado/metadatos pide detalle a SUNAT.
 * - `readContent` es el ÚNICO camino hacia el cuerpo de un elemento.
 * - La Clave SOL solo se escribe o reemplaza; nunca se devuelve.
 */
export interface BuzonAdapter {
	/** Cómo recibe su acceso un usuario nuevo: invitación por correo o contraseña inicial fijada por el administrador. */
	readonly userOnboarding: "invitation" | "initial_password";

	// Sesión de la app (no es la sesión SOL)
	login(email: string, password: string): Promise<CommandResult<AppSession>>;
	logout(): Promise<void>;
	getSession(): Promise<AppSession | null>;
	setReadWarning(enabled: boolean): Promise<CommandResult<AppSession>>;

	// Buzón por cuenta
	getSummary(accountId: AccountId): Promise<MailboxSummary>;
	listMail(accountId: AccountId, box: MailBox, request: ListRequest<MailListFilters, MailSortColumn>): Promise<MailPage>;
	listFolders(accountId: AccountId, box: MailBox): Promise<SunatFolder[]>;
	listTags(accountId: AccountId): Promise<SunatTag[]>;
	getItemMetadata(accountId: AccountId, itemId: ItemId): Promise<MailItemMetadata>;
	getRemoteState(accountId: AccountId, itemId: ItemId): Promise<RemoteReadState>;
	getActivity(accountId: AccountId): Promise<AccountActivity>;

	// Comandos semánticos del buzón
	startInventory(accountId: AccountId): Promise<CommandResult<InventoryRun>>;
	resumeRun(accountId: AccountId, runId: RunId): Promise<CommandResult<InventoryRun>>;
	readContent(accountId: AccountId, itemId: ItemId, idempotencyKey: string): Promise<CommandResult<MailDetail>>;
	downloadFile(accountId: AccountId, itemId: ItemId, fileId: FileId, onProgress?: (progress: number) => void): Promise<CommandResult<MailFile>>;
	setReviewed(accountId: AccountId, itemId: ItemId, reviewed: boolean): Promise<CommandResult<MailItemMetadata>>;

	// Archivo de la cuenta: contenido y archivos de elementos YA leídos en SUNAT (nunca abre un no leído)
	getArchiveStatus(accountId: AccountId): Promise<ArchiveStatus>;
	startArchive(accountId: AccountId, retryFailed: boolean): Promise<CommandResult<ArchiveStatus>>;
	getMailboxSettings(accountId: AccountId): Promise<MailboxSettings>;
	saveMailboxSettings(settings: MailboxSettings): Promise<CommandResult<MailboxSettings>>;
	/** Un inventario por cada cuenta activa que el usuario puede consultar. */
	startAllInventories(): Promise<CommandResult<BulkInventoryResult[]>>;

	// Administración de cuentas
	listAdminAccounts(request: ListRequest<AccountFilters, AccountSortColumn>): Promise<Page<AdminAccount>>;
	getAdminAccount(accountId: AccountId): Promise<AdminAccount>;
	createAccount(input: AccountInput): Promise<CommandResult<AdminAccount>>;
	updateAccount(accountId: AccountId, input: Omit<AccountInput, "ruc">): Promise<CommandResult<AdminAccount>>;
	replaceCredential(accountId: AccountId, solPassword: string): Promise<CommandResult<AdminAccount>>;
	testConnection(accountId: AccountId): Promise<CommandResult<CredentialTestResult>>;
	setAccountActive(accountId: AccountId, active: boolean): Promise<CommandResult<AdminAccount>>;
	getSchedule(accountId: AccountId): Promise<ScheduleConfig>;
	saveSchedule(config: Omit<ScheduleConfig, "nextRuns" | "pauseReason">): Promise<CommandResult<ScheduleConfig>>;
	listAccountUsers(accountId: AccountId): Promise<AppUser[]>;
	listScheduledRuns(): Promise<(InventoryRun & { accountAlias: string })[]>;

	// Usuarios y roles
	listUsers(request: ListRequest<UserFilters, UserSortColumn>): Promise<Page<AppUser>>;
	createUser(input: UserInput): Promise<CommandResult<AppUser>>;
	updateUser(userId: UserId, input: UserInput): Promise<CommandResult<AppUser>>;
	setUserStatus(userId: UserId, status: "active" | "disabled"): Promise<CommandResult<AppUser>>;
	listRoles(request?: ListRequest<RoleFilters, RoleSortColumn>): Promise<Page<RolePermissions>>;
	createRole(input: RoleInput): Promise<CommandResult<RolePermissions>>;
	updateRole(roleId: RoleId, input: RoleInput): Promise<CommandResult<RolePermissions>>;
	listAdminAccountOptions(): Promise<{ id: AccountId; alias: string }[]>;

	// Auditoría
	listAudit(request: ListRequest<AuditFilters, AuditSortColumn>): Promise<Page<AuditEntry>>;
	exportAuditCsv(filters: AuditFilters): Promise<CommandResult<string>>;

	// Configuraciones globales (sesión y seguridad)
	listSettings(): Promise<AppSetting[]>;
	saveSettings(values: Partial<SettingValues>): Promise<CommandResult<AppSetting[]>>;
	/** Avisa que la persona está usando la app; renueva la ventana de inactividad de la sesión. */
	touchSession(): Promise<void>;
}
