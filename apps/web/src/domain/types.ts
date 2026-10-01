/**
 * Modelos del frontend de Buzón SOL v2.
 *
 * Son la frontera PROVISIONAL con el backend: describen lo que la interfaz necesita,
 * no una respuesta HTTP acordada. Los IDs de cuenta y elemento son opacos; nunca
 * contienen RUC, usuario SOL ni tokens de SUNAT.
 */

export type AccountId = string & { readonly __brand: "AccountId" };
export type ItemId = string & { readonly __brand: "ItemId" };
export type UserId = string & { readonly __brand: "UserId" };
export type RoleId = string & { readonly __brand: "RoleId" };
export type RunId = string & { readonly __brand: "RunId" };
export type FileId = string & { readonly __brand: "FileId" };

/** Fecha/hora ISO 8601 en UTC. La presentación se hace en America/Lima. */
export type IsoDateTime = string;

// ─── Sesión, permisos y roles ────────────────────────────────────────────────

export const PERMISSIONS = [
	"view_mailbox",
	"read_content",
	"download_file",
	"mark_reviewed",
	"run_inventory",
	"view_audit",
	"configure_schedule",
	"manage_accounts",
	"manage_users_roles",
	"manage_settings",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export interface RolePermissions {
	id: RoleId;
	name: string;
	permissions: Permission[];
	/** Incluye todas las cuentas, también las que se agreguen después. */
	allAccounts: boolean;
	accountIds: AccountId[];
	userCount: number;
}

export type AppUserStatus = "active" | "invited" | "disabled";

export interface AppUser {
	id: UserId;
	name: string;
	email: string;
	status: AppUserStatus;
	roleId: RoleId;
	roleName: string;
	lastActivityAt: IsoDateTime | null;
}

/** Sesión de la app: la autorización mostrada sale de aquí, nunca del nombre del rol. */
export interface AppSession {
	user: AppUser;
	permissions: Permission[];
	visibleAccounts: VisibleAccount[];
	preferences: UserPreferences;
	/** Mínimo de caracteres de una contraseña nueva (Configuraciones). */
	passwordMinLength: number;
}

export interface UserPreferences {
	/** Aviso antes de abrir un no leído. */
	readWarningEnabled: boolean;
	readWarningChangedAt: IsoDateTime | null;
}

// ─── Cuentas SUNAT ───────────────────────────────────────────────────────────

export type CredentialStatus = "valid" | "rejected" | "missing" | "untested";

export type ScheduleState = "active" | "paused" | "disabled";

export type SyncState = "pending" | "running" | "complete" | "partial" | "retrying" | "paused";

export type PauseReason = "invalid_credential" | "repeated_failures" | "remote_unavailable" | "manual" | "needs_credential";

export interface ConnectionStatus {
	scheduleState: ScheduleState;
	syncState: SyncState | null;
	pauseReason: PauseReason | null;
	lastRunAt: IsoDateTime | null;
	lastRunState: SyncState | null;
	nextRunAt: IsoDateTime | null;
	/** Progreso de la ejecución en curso, si existe. */
	running: { box: MailBox; page: number; estimatedPages: number | null } | null;
}

/** Cuenta visible para un usuario (U1 / selector). Sin RUC completo ni usuario SOL. */
export interface VisibleAccount {
	id: AccountId;
	alias: string;
	rucMasked: string;
	active: boolean;
	connection: ConnectionStatus;
	/** Cantidad detectada por la última consulta completa respecto de la anterior (P-01). */
	newSinceLastRun: { messages: number; notifications: number };
	/** No vistos por el usuario actual (badge personal, P-01). */
	unseenByUser: number;
}

// ─── Bandejas e inventario ───────────────────────────────────────────────────

export type MailBox = "messages" | "notifications";

/** Estado remoto observado en SUNAT (`indEstado`) más la transición local de confirmación. */
export type RemoteReadState = "unread" | "confirming" | "read" | "unconfirmed";

export interface LocalReviewState {
	reviewed: boolean;
	reviewedAt: IsoDateTime | null;
	reviewedBy: string | null;
}

export interface SunatTag {
	code: string;
	name: string;
	/** `false` si el código no está en el catálogo conocido: se muestra neutro. */
	known: boolean;
	/** Color `#rrggbb` que SUNAT asigna a la etiqueta; sin él se usa el neutro. */
	color?: string | null;
}

export interface SunatFolder {
	code: string;
	name: string;
	count: number;
	locked: boolean;
}

/** Metadatos de inventario: nunca incluyen cuerpo ni URLs de SUNAT. */
export interface MailItemMetadata {
	id: ItemId;
	accountId: AccountId;
	box: MailBox;
	subject: string;
	sender: string;
	/** Texto de fecha tal como lo publica SUNAT (sin zona). */
	publishedAtText: string;
	/** Interpretación local explícita (America/Lima) para ordenar y filtrar. */
	publishedAt: IsoDateTime;
	tag: SunatTag | null;
	folderCode: string;
	remoteState: RemoteReadState;
	starred: boolean;
	urgent: boolean;
	attachmentCountDeclared: number;
	review: LocalReviewState;
	/** El usuario actual ya abrió este elemento antes (omite la confirmación por elemento). */
	openedBeforeByUser: boolean;
	/** Hay contenido guardado; abrirlo de nuevo no llama a SUNAT. */
	contentStored: boolean;
	firstSeenAt: IsoDateTime;
}

export type MailSortColumn = "publishedAt" | "subject" | "sender" | "remoteState";
export type SortDirection = "asc" | "desc";

export interface MailListFilters {
	query: string;
	state: "all" | "unread" | "read";
	folder: string | null;
	tag: string | null;
	dateFrom: string | null;
	dateTo: string | null;
	review: "all" | "reviewed" | "pending";
}

export interface ListRequest<TFilters, TSort extends string> {
	filters: TFilters;
	sort: { column: TSort; direction: SortDirection } | null;
	page: number;
	pageSize: number;
}

export interface Page<T> {
	rows: T[];
	/** Registros que cumplen el filtro dentro de lo inventariado. */
	total: number;
	page: number;
	pageSize: number;
}

export interface InventoryCoverage {
	state: SyncState | null;
	/** Únicos registrados hasta ahora. Solo es «verificado» cuando `verified`. */
	uniqueCount: number;
	verified: boolean;
	pagesScanned: number;
	estimatedPages: number | null;
	/** Total que declara SUNAT en su paginación; secundario y diagnóstico. */
	declaredBySunat: number | null;
}

export interface MailPage extends Page<MailItemMetadata> {
	coverage: InventoryCoverage;
}

export interface BoxSummary {
	box: MailBox;
	coverage: InventoryCoverage;
	unreadInSunat: number;
	/** Leídos en SUNAT pero sin revisar en la app por el usuario actual. */
	pendingReview: number;
}

export interface PendingIssue {
	id: string;
	kind: "failed_downloads" | "pending_review" | "partial_inventory" | "credential";
	box: MailBox | null;
	count: number;
	text: string;
}

export interface MailboxSummary {
	accountId: AccountId;
	connection: ConnectionStatus;
	boxes: Record<MailBox, BoxSummary>;
	/** Nuevos desde la última visita del usuario (sin cuerpo). */
	newItems: MailItemMetadata[];
	pending: PendingIssue[];
	scheduleText: string;
}

// ─── Detalle, lectura y archivos ─────────────────────────────────────────────

export type FileKind = "generated_document" | "attachment";

export type AttachmentState =
	| { status: "available" }
	| { status: "downloading"; progress: number }
	| { status: "stored"; storedAt: IsoDateTime }
	| { status: "failed"; reason: "remote_unavailable" | "invalid_response" | "forbidden" };

export interface MailFile {
	id: FileId;
	kind: FileKind;
	name: string;
	/** MIME observado; puede ser desconocido. No asumir formato por la extensión. */
	mimeType: string | null;
	sizeBytes: number | null;
	state: AttachmentState;
}

/** Resultado de `readContent`. El HTML ya viene sanitizado por el backend y se vuelve a sanitizar en cliente. */
export interface MailDetail {
	itemId: ItemId;
	accountId: AccountId;
	bodyHtml: string;
	/** `true` si esta lectura hizo una petición de detalle a SUNAT. */
	remoteCallMade: boolean;
	remoteState: RemoteReadState;
	files: MailFile[];
	readEventId: string;
}

// ─── Actividad de inventario ─────────────────────────────────────────────────

export interface BoxRunProgress {
	box: MailBox;
	state: SyncState;
	pagesScanned: number;
	estimatedPages: number | null;
	found: number;
	unique: number;
	duplicatesSkipped: number;
	attachmentsStored: number;
	errors: number;
	errorText: string | null;
	declaredMatches: boolean | null;
}

export interface InventoryRun {
	id: RunId;
	accountId: AccountId;
	mode: "manual" | "scheduled" | "test";
	startedAt: IsoDateTime;
	finishedAt: IsoDateTime | null;
	boxes: MailBox[];
	state: SyncState;
	pauseReason: PauseReason | null;
	resultText: string;
	/** Página desde la que se reanudaría (bandeja pausada). */
	resumeFrom: { box: MailBox; page: number } | null;
	/** SUNAT abrió automáticamente el primer elemento al ingresar (posible efecto remoto). */
	autoOpenedFirstItem: boolean;
}

export interface AccountActivity {
	accountId: AccountId;
	connection: ConnectionStatus;
	progress: BoxRunProgress[];
	currentRun: InventoryRun | null;
	history: InventoryRun[];
}

// ─── Archivo de la cuenta ────────────────────────────────────────────────────

/** Qué guarda la app, por cuenta, de los elementos que SUNAT ya lista como leídos. */
export interface MailboxSettings {
	accountId: AccountId;
	/** Guardar el contenido de los elementos ya leídos en SUNAT. Nunca abre un no leído. */
	archiveContent: boolean;
	/** Guardar además sus archivos. Exige `archiveContent`. */
	archiveFiles: boolean;
	/** Elementos por lote (una sesión SUNAT por lote). */
	archiveBatchSize: number;
}

export interface ArchiveRun {
	id: string;
	trigger: "manual" | "inventory" | "continue";
	state: "pending" | "running" | "complete" | "partial";
	errorCode: string | null;
	itemsDone: number;
	itemsFailed: number;
	filesStored: number;
	filesFailed: number;
	/** Leídos en SUNAT aún sin archivar al terminar el lote. */
	remaining: number | null;
	startedAt: IsoDateTime | null;
	finishedAt: IsoDateTime | null;
}

export interface ArchiveStatus {
	accountId: AccountId;
	settings: MailboxSettings;
	items: { total: number; readInSunat: number; unreadInSunat: number; withContent: number; pendingContent: number };
	files: { stored: number; pending: number; failed: number };
	current: ArchiveRun | null;
	history: ArchiveRun[];
}

/** Resultado por cuenta de «Consultar todas»: una cuenta que no pudo iniciar no detiene a las demás. */
export interface BulkInventoryResult {
	accountId: AccountId;
	alias: string;
	started: boolean;
	errorCode: string | null;
}

// ─── Administración ──────────────────────────────────────────────────────────

export interface AdminAccount {
	id: AccountId;
	alias: string;
	rucMasked: string;
	solUserMasked: string | null;
	active: boolean;
	credential: { status: CredentialStatus; savedAt: IsoDateTime | null; rejectedAt: IsoDateTime | null };
	connection: ConnectionStatus;
	scheduleSummary: string;
	newSinceLastRun: { messages: number; notifications: number };
	userCount: number;
	createdAt: IsoDateTime;
}

export type ScheduleFrequency = "30m" | "1h" | "2h" | "4h" | "daily";
export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface ScheduleConfig {
	accountId: AccountId;
	state: ScheduleState;
	frequency: ScheduleFrequency;
	days: Weekday[];
	/** Horas locales America/Lima, "HH:mm". */
	windowStart: string;
	windowEnd: string;
	boxes: MailBox[];
	/** P-03: solo si el detalle y URL ya están guardados; nunca abre no leídos. */
	downloadReadAttachments: boolean;
	notifyInApp: boolean;
	notifyDailyEmail: boolean;
	/** Aceptación administrativa del posible efecto remoto del inicio de sesión (G-02). */
	remoteEffectAccepted: boolean;
	nextRuns: IsoDateTime[];
	pauseReason: PauseReason | null;
}

export type AuditAction = "create" | "update" | "disable" | "enable" | "preference" | "read" | "download" | "credential" | "test" | "failure" | "session" | "inventory";

export interface AuditEntry {
	id: string;
	at: IsoDateTime;
	actor: string;
	action: AuditAction;
	objectLabel: string;
	objectType: "account" | "credential" | "schedule" | "role" | "user" | "preference" | "item" | "file" | "run" | "settings";
	change: string;
}

export interface AuditFilters {
	action: AuditAction | "all";
	objectType: AuditEntry["objectType"] | "all";
	actor: string | "all";
	range: "7d" | "30d" | "all";
}

// ─── Configuraciones ─────────────────────────────────────────────────────────

export const SETTING_KEYS = [
	"session.absoluteMinutes",
	"session.idleMinutes",
	"security.passwordMinLength",
	"security.maxFailedLogins",
	"security.lockoutMinutes",
] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];

/** Un ajuste global con su valor actual, el valor por defecto y el rango que acepta el servidor. */
export interface AppSetting {
	key: SettingKey;
	value: number;
	default: number;
	min: number;
	max: number;
	updatedAt: IsoDateTime | null;
}

export type SettingValues = Record<SettingKey, number>;
