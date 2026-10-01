import {
	AppError,
	type AccountFilters,
	type AppErrorCode,
	type AccountInput,
	type AccountSortColumn,
	type AuditSortColumn,
	type BuzonAdapter,
	type CommandResult,
	type CredentialTestResult,
	type RoleFilters,
	type RoleInput,
	type RoleSortColumn,
	type UserFilters,
	type UserInput,
	type UserSortColumn,
} from "@/domain/adapter";
import {
	PERMISSIONS,
	type AccountId,
	type AdminAccount,
	type AppSession,
	type AccountActivity,
	type AppUser,
	type ArchiveStatus,
	type AuditAction,
	type AuditEntry,
	type AuditFilters,
	type BulkInventoryResult,
	type ConnectionStatus,
	type CredentialStatus,
	type FileId,
	type InventoryRun,
	type ItemId,
	type ListRequest,
	type MailBox,
	type MailDetail,
	type MailFile,
	type MailItemMetadata,
	type MailListFilters,
	type MailPage,
	type MailSortColumn,
	type MailboxSettings,
	type AppSetting,
	type SettingValues,
	type MailboxSummary,
	type Page,
	type PauseReason,
	type PendingIssue,
	type RemoteReadState,
	type Permission,
	type RoleId,
	type RolePermissions,
	type RunId,
	type ScheduleConfig,
	type ScheduleState,
	type SunatFolder,
	type SunatTag,
	type UserId,
	type VisibleAccount,
} from "@/domain/types";
import { compare, paginate } from "@/adapters/paging";
import { scheduleSummaryText } from "@/lib/schedule";
import { includesNormalized } from "@/lib/text";
import { HttpClient } from "./http-client";
import {
	downloadName,
	toArchiveStatus,
	toCoverage,
	toFile,
	toMetadata,
	toProgress,
	toRemoteState,
	toRun,
	toSyncState,
	type ActivityDto,
	type ArchiveStatusDto,
	type DetailDto,
	type MailListDto,
	type MailRowDto,
	type RunDto,
	type SummaryDto,
} from "./mailbox";

// ─── Respuestas de la API (apps/api/openapi.yaml) ────────────────────────────

interface MeDto {
	id: string;
	email: string;
	name: string;
	roleId: string;
	roleName: string;
	permissions: string[];
	preferences: { readWarningEnabled: boolean };
	policy: { passwordMinLength: number };
}
interface ScheduleStateDto {
	scheduleState: string;
	pauseReason: string | null;
}
interface VisibleAccountDto extends ScheduleStateDto {
	id: string;
	alias: string;
	active: number | boolean;
	rucMasked: string | null;
	nextRunAt?: string | null;
	runState?: string | null;
	runStartedAt?: string | null;
	runFinishedAt?: string | null;
	runBox?: number | null;
	runPage?: number | null;
	lastCompleteAt?: string | null;
	newMessages?: number | string | null;
	newNotifications?: number | string | null;
}
interface AdminAccountDto extends VisibleAccountDto {
	solUserMasked: string | null;
	createdAt: string;
	credentialStatus: string | null;
	credentialSavedAt: string | null;
	nextRunAt: string | null;
	userCount: number | string;
}
interface UserDto {
	id: string;
	email: string;
	name: string;
	status: string;
	roleId: string;
	roleName: string;
	lastLoginAt: string | null;
}
interface RoleDto {
	id: string;
	name: string;
	allAccounts: boolean;
	permissions: string[];
	accountIds: string[];
	userCount: number;
}
interface ScheduleDto extends Omit<ScheduleConfig, "accountId" | "pauseReason" | "state"> {
	state: string;
	pauseReason: string | null;
}
interface AuditDto {
	id: string;
	at: string;
	action: string;
	objectType: string;
	actorName: string | null;
	accountAlias: string | null;
	objectName: string | null;
}

interface ConnectionTestDto {
	id: string;
	status: string;
	errorCode?: string | null;
	finishedAt?: string | null;
}

// ─── Traducción al modelo de la interfaz ─────────────────────────────────────

const ok = <T>(data: T): CommandResult<T> => ({ ok: true, data });
const run = async <T>(fn: () => Promise<T>): Promise<CommandResult<T>> => {
	try {
		return ok(await fn());
	} catch (error) {
		if (error instanceof AppError) return { ok: false, error };
		throw error;
	}
};

/** Códigos con los que el worker puede cerrar un trabajo; lo demás se muestra como «SUNAT no respondió». */
const JOB_ERRORS: readonly AppErrorCode[] = ["forbidden", "not_found", "needs_credential", "invalid_credential", "paused", "remote_session_expired", "remote_disabled", "remote_unavailable", "schema_changed", "conflict_running"];
const jobError = (code: string | null | undefined) => new AppError(JOB_ERRORS.find((known) => known === code) ?? "remote_unavailable");

/** Entrega el archivo al navegador como descarga; el contenido nunca se abre dentro de la app. */
const saveToDevice = (blob: Blob, name: string) => {
	if (typeof URL.createObjectURL !== "function") return;
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = name;
	link.rel = "noopener";
	document.body.append(link);
	link.click();
	link.remove();
	setTimeout(() => URL.revokeObjectURL(url), 10_000);
};

const PAUSE_REASONS: readonly PauseReason[] = ["invalid_credential", "repeated_failures", "remote_unavailable", "manual", "needs_credential"];
const toPauseReason = (value: string | null): PauseReason | null => (value === null ? null : (PAUSE_REASONS.find((r) => r === value) ?? "manual"));
const toScheduleState = (value: string): ScheduleState => (value === "active" || value === "paused" ? value : "disabled");
const toPermissions = (values: string[]): Permission[] => PERMISSIONS.filter((p) => values.includes(p));

/** Estado persistido de la cuenta: programador y última consulta. Listarlo nunca contacta a SUNAT. */
const toConnection = (dto: VisibleAccountDto): ConnectionStatus => {
	const state = toSyncState(dto.runState);
	const busy = state === "running" || state === "pending";
	return {
		scheduleState: toScheduleState(dto.scheduleState),
		syncState: state,
		pauseReason: toPauseReason(dto.pauseReason),
		// Con una consulta en curso, la «última» es la completa anterior.
		lastRunAt: busy ? (dto.lastCompleteAt ?? null) : (dto.runFinishedAt ?? dto.runStartedAt ?? null),
		lastRunState: busy ? (dto.lastCompleteAt ? "complete" : null) : state,
		nextRunAt: dto.nextRunAt ?? null,
		running: state === "running" ? { box: dto.runBox === 2 ? "notifications" : "messages", page: dto.runPage ?? 1, estimatedPages: null } : null,
	};
};
const toNewSinceLastRun = (dto: VisibleAccountDto) => ({ messages: Number(dto.newMessages ?? 0), notifications: Number(dto.newNotifications ?? 0) });

const toVisibleAccount = (dto: VisibleAccountDto): VisibleAccount => ({
	id: dto.id as AccountId,
	alias: dto.alias,
	rucMasked: dto.rucMasked ?? "—",
	active: Boolean(dto.active),
	connection: toConnection(dto),
	newSinceLastRun: toNewSinceLastRun(dto),
	// La API no registra qué vio cada usuario; el aviso de novedades es por cuenta.
	unseenByUser: 0,
});

const CREDENTIAL_STATES: readonly CredentialStatus[] = ["valid", "rejected", "untested"];
const toAdminAccount = (dto: AdminAccountDto): AdminAccount => {
	const connection = toConnection(dto);
	return {
		id: dto.id as AccountId,
		alias: dto.alias,
		rucMasked: dto.rucMasked ?? "—",
		solUserMasked: dto.solUserMasked,
		active: Boolean(dto.active),
		credential: { status: CREDENTIAL_STATES.find((s) => s === dto.credentialStatus) ?? "missing", savedAt: dto.credentialSavedAt, rejectedAt: null },
		connection,
		// Sin la configuración completa: el listado solo conoce el estado del programador.
		scheduleSummary: connection.scheduleState === "active" ? "Activo" : scheduleSummaryText({ state: connection.scheduleState, frequency: "1h", days: [], pauseReason: connection.pauseReason }),
		newSinceLastRun: toNewSinceLastRun(dto),
		userCount: Number(dto.userCount),
		createdAt: dto.createdAt,
	};
};

const toUser = (dto: UserDto): AppUser => ({
	id: dto.id as UserId,
	name: dto.name,
	email: dto.email,
	status: dto.status === "active" || dto.status === "invited" ? dto.status : "disabled",
	roleId: dto.roleId as RoleId,
	roleName: dto.roleName,
	// La API registra el último ingreso, no cada acción.
	lastActivityAt: dto.lastLoginAt,
});

const toRole = (dto: RoleDto): RolePermissions => ({
	id: dto.id as RoleId,
	name: dto.name,
	permissions: toPermissions(dto.permissions),
	allAccounts: dto.allAccounts,
	accountIds: dto.accountIds as AccountId[],
	userCount: dto.userCount,
});

const AUDIT_ACTIONS: Record<string, { action: AuditAction; change: string }> = {
	login: { action: "session", change: "Inicio de sesión" },
	logout: { action: "session", change: "Cierre de sesión" },
	bootstrap: { action: "create", change: "Alta del primer administrador" },
	create: { action: "create", change: "Alta" },
	update: { action: "update", change: "Datos actualizados" },
	enable: { action: "enable", change: "Activado" },
	disable: { action: "disable", change: "Desactivado" },
	credential: { action: "credential", change: "Clave SOL reemplazada (valor no registrado)" },
	rotate_key: { action: "credential", change: "Rotación de la clave de cifrado" },
	preference: { action: "preference", change: "Preferencia actualizada" },
	set_reviewed: { action: "update", change: "Revisión local actualizada" },
	test_connection: { action: "test", change: "Prueba de conexión solicitada" },
	test_connection_result: { action: "test", change: "Resultado de la prueba de conexión" },
	start: { action: "inventory", change: "Consulta o archivo solicitado" },
	archive_result: { action: "inventory", change: "Lote de archivo terminado" },
	archive_unexpected_read: { action: "failure", change: "Archivo detenido: SUNAT marcó un elemento como leído" },
	resume: { action: "inventory", change: "Reanudación solicitada" },
	schedule_due: { action: "inventory", change: "Consulta programada" },
	recover_orphan: { action: "inventory", change: "Consulta interrumpida recuperada" },
	read: { action: "read", change: "Lectura de contenido solicitada" },
	fetch_file: { action: "download", change: "Obtención de archivo solicitada" },
	fetch_file_result: { action: "download", change: "Resultado de la obtención de archivo" },
	download: { action: "download", change: "Descarga de archivo" },
};
const AUDIT_OBJECTS: Record<string, AuditEntry["objectType"]> = {
	account: "account",
	credential: "credential",
	connection_test: "credential",
	schedule: "schedule",
	role: "role",
	user: "user",
	preference: "preference",
	item: "item",
	mail_item: "item",
	file: "file",
	file_fetch: "file",
	sync_run: "run",
	archive_run: "run",
	mailbox_settings: "account",
	settings: "settings",
};
const OBJECT_NOUN: Record<AuditEntry["objectType"], string> = {
	account: "Cuenta",
	credential: "Credencial",
	schedule: "Programador",
	role: "Rol",
	user: "Usuario",
	preference: "Preferencia",
	item: "Elemento del buzón",
	file: "Archivo",
	run: "Consulta",
	settings: "Configuraciones",
};

const toAudit = (dto: AuditDto): AuditEntry => {
	const known = AUDIT_ACTIONS[dto.action];
	const objectType = AUDIT_OBJECTS[dto.objectType] ?? "account";
	const name = dto.objectName ?? dto.accountAlias;
	return {
		id: dto.id,
		at: dto.at,
		actor: dto.actorName ?? "Sistema",
		action: known?.action ?? "update",
		objectType,
		objectLabel: objectType === "account" || objectType === "user" ? (name ?? OBJECT_NOUN[objectType]) : name ? `${OBJECT_NOUN[objectType]} · ${name}` : OBJECT_NOUN[objectType],
		change: known?.change ?? dto.action,
	};
};

const DEFAULT_SCHEDULE: Omit<ScheduleConfig, "accountId"> = {
	state: "disabled",
	frequency: "1h",
	days: ["mon", "tue", "wed", "thu", "fri"],
	windowStart: "07:00",
	windowEnd: "20:00",
	boxes: ["messages", "notifications"],
	downloadReadAttachments: false,
	notifyInApp: true,
	notifyDailyEmail: false,
	remoteEffectAccepted: false,
	nextRuns: [],
	pauseReason: null,
};

/**
 * Cliente del backend. Las consultas del buzón leen solo lo persistido; los comandos que
 * contactan a SUNAT (inventario, lectura, archivos, prueba de conexión) se encolan y aquí se
 * espera su resultado. Si la puerta del servidor está cerrada, la API responde
 * `remote_unavailable`. Los listados de gestión son cortos y la API los entrega completos:
 * filtro, orden y página se resuelven aquí.
 */
export class HttpAdapter implements BuzonAdapter {
	readonly userOnboarding = "initial_password" as const;
	/** Solo se conoce el ingreso hecho en esta pestaña; tras recargar queda sin dato. */
	private signedInAt: string | null = null;

	constructor(
		private readonly http = new HttpClient(),
		private readonly pollMs = 1500,
	) {}

	// ─── Sesión ──────────────────────────────────────────────────────────────

	async login(email: string, password: string): Promise<CommandResult<AppSession>> {
		try {
			await this.http.post("/auth/login", { email, password }, { "X-Session-Mode": "cookie" });
			this.signedInAt = new Date().toISOString();
			const session = await this.getSession();
			if (session) return ok(session);
		} catch (error) {
			if (!(error instanceof AppError)) throw error;
		}
		// Mensaje único: no revela si el correo existe.
		return { ok: false, error: new AppError("unauthenticated", "Correo o contraseña incorrectos") };
	}

	async logout() {
		await this.http.post("/auth/logout");
	}

	async getSession(): Promise<AppSession | null> {
		try {
			const me = await this.http.get<MeDto>("/auth/me");
			this.userName = me.name;
			const permissions = toPermissions(me.permissions);
			const accounts = permissions.includes("view_mailbox") ? await this.http.get<VisibleAccountDto[]>("/accounts") : [];
			return {
				user: { id: me.id as UserId, name: me.name, email: me.email, status: "active", roleId: me.roleId as RoleId, roleName: me.roleName, lastActivityAt: this.signedInAt },
				permissions,
				visibleAccounts: accounts.map(toVisibleAccount),
				preferences: { readWarningEnabled: me.preferences.readWarningEnabled, readWarningChangedAt: null },
				passwordMinLength: me.policy.passwordMinLength,
			};
		} catch (error) {
			if (error instanceof AppError && error.code === "unauthenticated") return null;
			throw error;
		}
	}

	setReadWarning(enabled: boolean) {
		return run(async () => {
			await this.http.patch("/auth/me/preferences", { readWarningEnabled: enabled });
			const session = await this.getSession();
			if (!session) throw new AppError("unauthenticated");
			return session;
		});
	}

	// ─── Buzón ───────────────────────────────────────────────────────────────

	private userName: string | null = null;

	/** Espera a que el worker cierre un trabajo encolado. */
	private async poll<T extends { status: string }>(path: string, first: T, open: readonly string[], timeoutMs = 120_000): Promise<T> {
		let current = first;
		for (let waited = 0; open.includes(current.status); waited += this.pollMs) {
			if (waited >= timeoutMs) throw new AppError("conflict_running");
			await new Promise((resolve) => setTimeout(resolve, this.pollMs));
			current = await this.http.get<T>(path);
		}
		return current;
	}

	private async visibleAccount(accountId: AccountId): Promise<VisibleAccountDto> {
		const account = (await this.http.get<VisibleAccountDto[]>("/accounts")).find((a) => a.id === accountId);
		if (!account) throw new AppError("not_found");
		return account;
	}

	private row(accountId: AccountId, itemId: ItemId) {
		return this.http.get<MailRowDto>(`/accounts/${accountId}/items/${itemId}`);
	}

	async getSummary(accountId: AccountId): Promise<MailboxSummary> {
		const [summary, activity, account, schedule] = await Promise.all([
			this.http.get<SummaryDto>(`/accounts/${accountId}/summary`),
			this.http.get<ActivityDto>(`/accounts/${accountId}/activity`),
			this.visibleAccount(accountId),
			// El detalle del programador exige su propio permiso; sin él se resume por su estado.
			this.getSchedule(accountId).catch(() => null),
		]);
		const fresh = summary.newSince ? await this.http.get<MailListDto>(`/accounts/${accountId}/mail?${new URLSearchParams({ seenAfter: summary.newSince, sort: "firstSeenAt", limit: "20" })}`) : { rows: [] };
		const connection = toConnection(account);
		const pending: PendingIssue[] = [];
		if (summary.state === "partial") pending.push({ id: "partial", kind: "partial_inventory", box: null, count: 1, text: "La última consulta quedó incompleta. Puede reanudarla desde Actividad." });
		if (summary.failedFiles > 0) pending.push({ id: "failed", kind: "failed_downloads", box: null, count: summary.failedFiles, text: `${summary.failedFiles} ${summary.failedFiles === 1 ? "archivo no se pudo guardar" : "archivos no se pudieron guardar"}.` });
		const review = summary.pendingReview.messages + summary.pendingReview.notifications;
		if (review > 0) pending.push({ id: "review", kind: "pending_review", box: null, count: review, text: `${review} ${review === 1 ? "elemento leído en SUNAT aún no está revisado" : "elementos leídos en SUNAT aún no están revisados"} en buzon-sol.` });
		const box = (b: MailBox) => ({ box: b, coverage: toCoverage(summary, activity, b), unreadInSunat: summary.boxes[b].unreadInSunat, pendingReview: summary.pendingReview[b] });
		return {
			accountId,
			connection,
			boxes: { messages: box("messages"), notifications: box("notifications") },
			initialLoad: summary.initialLoad ?? { done: true, active: false },
			newItems: fresh.rows.map((r) => toMetadata(accountId, r, this.userName)),
			pending,
			scheduleText: scheduleSummaryText(schedule ?? { state: connection.scheduleState, frequency: "1h", days: [], pauseReason: connection.pauseReason }),
		};
	}

	async listMail(accountId: AccountId, box: MailBox, request: ListRequest<MailListFilters, MailSortColumn>): Promise<MailPage> {
		const { filters, sort } = request;
		const pageSize = Math.min(Math.max(request.pageSize, 1), 200);
		const params = new URLSearchParams({ box, offset: String((request.page - 1) * pageSize), limit: String(pageSize), state: filters.state, review: filters.review });
		// Pendiente de revisión: ya leído en SUNAT y con contenido guardado, sin la marca local del usuario.
		if (filters.review === "pending") {
			params.set("content", "stored");
			if (filters.state === "all") params.set("state", "read");
		}
		if (filters.query.trim()) params.set("q", filters.query.trim());
		if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
		if (filters.dateTo) params.set("dateTo", filters.dateTo);
		if (filters.folder) params.set("folder", filters.folder);
		if (filters.tag) params.set("label", filters.tag);
		if (sort) {
			params.set("sort", sort.column);
			params.set("direction", sort.direction);
		}
		const [list, summary, activity] = await Promise.all([
			this.http.get<MailListDto>(`/accounts/${accountId}/mail?${params}`),
			this.http.get<SummaryDto>(`/accounts/${accountId}/summary`),
			this.http.get<ActivityDto>(`/accounts/${accountId}/activity`),
		]);
		return { rows: list.rows.map((r) => toMetadata(accountId, r, this.userName)), total: Number(list.total), page: request.page, pageSize, coverage: toCoverage(summary, activity, box) };
	}

	/** La pertenencia de cada elemento a una carpeta no está validada con SUNAT (S-10): aún no se ofrece ese filtro. */
	async listFolders(): Promise<SunatFolder[]> {
		return [];
	}

	async listTags(accountId: AccountId): Promise<SunatTag[]> {
		const catalog = await this.http.get<{ items: { code: string; name: string; color?: string | null }[] }>(`/accounts/${accountId}/labels`);
		return catalog.items.map((label) => ({ code: label.code, name: label.name, known: true, color: label.color ?? null }));
	}

	async getItemMetadata(accountId: AccountId, itemId: ItemId): Promise<MailItemMetadata> {
		return toMetadata(accountId, await this.row(accountId, itemId), this.userName);
	}

	async getRemoteState(accountId: AccountId, itemId: ItemId): Promise<RemoteReadState> {
		return toRemoteState(await this.row(accountId, itemId));
	}

	async getActivity(accountId: AccountId): Promise<AccountActivity> {
		const [activity, account] = await Promise.all([this.http.get<ActivityDto>(`/accounts/${accountId}/activity`), this.visibleAccount(accountId)]);
		const current = activity.current && (activity.current.state === "running" || activity.current.state === "pending") ? toRun(accountId, activity.current) : null;
		return { accountId, connection: toConnection(account), progress: toProgress(activity), currentRun: current, history: activity.history.map((r) => toRun(accountId, r)) };
	}

	async listScheduledRuns(): Promise<(InventoryRun & { accountAlias: string })[]> {
		const runs = await this.http.get<RunDto[]>("/admin/runs");
		return runs.map((r) => ({ ...toRun(r.accountId as AccountId, r), accountAlias: r.accountAlias ?? "—" }));
	}

	private async queuedRun(accountId: AccountId, runId: string): Promise<InventoryRun> {
		const activity = await this.http.get<ActivityDto>(`/accounts/${accountId}/activity`);
		const run = activity.history.find((r) => r.id === runId);
		return toRun(accountId, run ?? { id: runId, mode: "manual", state: "pending", startedAt: null, finishedAt: null, resumeBox: 1, resumePage: 1, errorCode: null, boxes: null, newMessages: null, newNotifications: null });
	}

	startInventory = (accountId: AccountId, options?: { full?: boolean }) =>
		run(async () => {
			const { id } = await this.http.post<{ id: string }>(`/accounts/${accountId}/inventory`, options?.full ? { full: true } : undefined);
			return this.queuedRun(accountId, id);
		});

	resumeRun = (accountId: AccountId, runId: RunId) =>
		run(async () => {
			const { id } = await this.http.post<{ id: string }>(`/accounts/${accountId}/runs/${runId}/resume`);
			return this.queuedRun(accountId, id);
		});

	startAllInventories = () =>
		run(async (): Promise<BulkInventoryResult[]> => {
			const [results, accounts] = await Promise.all([
				this.http.post<{ accountId: string; runId: string | null; code: string | null }[]>("/inventory"),
				this.http.get<VisibleAccountDto[]>("/accounts").catch(() => []),
			]);
			return results.map((r) => ({ accountId: r.accountId as AccountId, alias: accounts.find((a) => a.id === r.accountId)?.alias ?? "Cuenta", started: r.runId !== null, errorCode: r.code }));
		});

	/**
	 * Único camino al cuerpo. Con contenido ya guardado no se llama a SUNAT; si no, se encola la
	 * lectura (la API registra antes la intención) y se espera a que el worker la complete.
	 */
	readContent = (accountId: AccountId, itemId: ItemId, idempotencyKey: string) =>
		run(async (): Promise<MailDetail> => {
			const before = await this.row(accountId, itemId);
			let readEventId = "";
			if (!before.contentStored) {
				const path = `/accounts/${accountId}/items/${itemId}`;
				const queued = await this.http.post<{ id: string; status: string }>(`${path}/read`, undefined, { "Idempotency-Key": idempotencyKey });
				const event = await this.poll(`${path}/reads/${queued.id}`, queued, ["pending", "calling"]);
				if (event.status === "denied") throw new AppError("forbidden");
				if (event.status !== "complete") throw new AppError("remote_unavailable");
				readEventId = event.id;
			}
			const [detail, after] = await Promise.all([this.http.get<DetailDto>(`/accounts/${accountId}/items/${itemId}/detail`), this.row(accountId, itemId)]);
			return { itemId, accountId, bodyHtml: detail.bodyHtml, remoteCallMade: !before.contentStored, remoteState: toRemoteState(after), files: detail.files.map((f) => toFile(f, detail.fetchedAt)), readEventId };
		});

	/** Obtiene el archivo en el espacio de la cuenta si aún no está guardado y lo entrega al equipo del usuario. */
	downloadFile = (accountId: AccountId, _itemId: ItemId, fileId: FileId, onProgress?: (progress: number) => void) =>
		run(async (): Promise<MailFile> => {
			const detail = await this.http.get<DetailDto>(`/accounts/${accountId}/items/${_itemId}/detail`);
			const dto = detail.files.find((f) => f.id === fileId);
			if (!dto) throw new AppError("not_found");
			const path = `/accounts/${accountId}/files/${fileId}`;
			if (dto.state !== "stored") {
				onProgress?.(10);
				const queued = await this.http.post<{ id: string; status: string; errorCode?: string | null }>(`${path}/fetch`);
				if (queued.status !== "stored") {
					onProgress?.(35);
					const fetched = await this.poll(`${path}/fetches/${queued.id}`, queued, ["pending", "fetching"]);
					if (fetched.status === "denied") throw new AppError("forbidden");
					if (fetched.status !== "complete") throw jobError(fetched.errorCode);
				}
			}
			onProgress?.(80);
			const stored = (await this.http.get<DetailDto>(`/accounts/${accountId}/items/${_itemId}/detail`)).files.find((f) => f.id === fileId) ?? dto;
			const file = toFile({ ...stored, state: "stored" }, new Date().toISOString());
			saveToDevice(await this.http.blob(path), downloadName(file));
			onProgress?.(100);
			return file;
		});

	setReviewed = (accountId: AccountId, itemId: ItemId, reviewed: boolean) =>
		run(async () => {
			await this.http.patch(`/accounts/${accountId}/items/${itemId}/review`, { reviewed });
			return this.getItemMetadata(accountId, itemId);
		});

	// ─── Archivo de la cuenta ────────────────────────────────────────────────

	async getArchiveStatus(accountId: AccountId): Promise<ArchiveStatus> {
		return toArchiveStatus(accountId, await this.http.get<ArchiveStatusDto>(`/accounts/${accountId}/archive`));
	}

	startArchive = (accountId: AccountId, retryFailed: boolean) =>
		run(async () => {
			await this.http.post(`/accounts/${accountId}/archive`, { retryFailed });
			return this.getArchiveStatus(accountId);
		});

	async getMailboxSettings(accountId: AccountId): Promise<MailboxSettings> {
		return { ...(await this.http.get<MailboxSettings>(`/admin/accounts/${accountId}/mailbox-settings`)), accountId };
	}

	saveMailboxSettings = (settings: MailboxSettings) =>
		run(async () => {
			const { accountId, ...body } = settings;
			await this.http.patch(`/admin/accounts/${accountId}/mailbox-settings`, body);
			return this.getMailboxSettings(accountId);
		});

	/**
	 * Encola la prueba y espera su resultado: el worker inicia sesión en SUNAT y lista ambas
	 * bandejas, sin abrir ningún elemento. Sin la puerta del servidor responde `remote_disabled`.
	 */
	testConnection = (accountId: AccountId) =>
		run(async (): Promise<CredentialTestResult> => {
			const path = `/admin/accounts/${accountId}/connection-tests`;
			let test = await this.http.post<ConnectionTestDto>(path);
			for (let waited = 0; test.status === "pending" || test.status === "testing"; waited += this.pollMs) {
				if (waited >= 90_000) throw new AppError("remote_unavailable");
				await new Promise((resolve) => setTimeout(resolve, this.pollMs));
				test = await this.http.get<ConnectionTestDto>(`${path}/${test.id}`);
			}
			if (test.status === "valid" || test.status === "invalid") {
				return { accepted: test.status === "valid", autoOpenedFirstItem: false, testedAt: test.finishedAt ?? new Date().toISOString() };
			}
			if (test.status === "denied") throw new AppError("forbidden");
			throw jobError(test.errorCode);
		});

	// ─── Cuentas ─────────────────────────────────────────────────────────────

	private async adminAccounts() {
		return (await this.http.get<AdminAccountDto[]>("/admin/accounts")).map(toAdminAccount);
	}

	async listAdminAccounts(request: ListRequest<AccountFilters, AccountSortColumn>): Promise<Page<AdminAccount>> {
		const { filters, sort } = request;
		const rows = (await this.adminAccounts()).filter(
			(a) => includesNormalized(a.alias, filters.alias) && (filters.credential === "all" || a.credential.status === filters.credential) && (filters.schedule === "all" || a.connection.scheduleState === filters.schedule),
		);
		if (sort) {
			const key = (a: AdminAccount) => (sort.column === "alias" ? a.alias : sort.column === "credential" ? a.credential.status : (a.connection.lastRunAt ?? ""));
			rows.sort((a, b) => compare(key(a), key(b), sort.direction));
		}
		return paginate(rows, request.page, request.pageSize);
	}

	async getAdminAccount(accountId: AccountId): Promise<AdminAccount> {
		const account = (await this.adminAccounts()).find((a) => a.id === accountId);
		if (!account) throw new AppError("not_found");
		return account;
	}

	createAccount(input: AccountInput) {
		return run(async () => {
			const { id } = await this.http.post<{ id: AccountId }>("/admin/accounts", { alias: input.alias.trim(), ruc: input.ruc, solUser: input.solUser.trim() });
			return this.getAdminAccount(id);
		});
	}

	updateAccount(accountId: AccountId, input: Omit<AccountInput, "ruc">) {
		return run(async () => {
			// Usuario SOL vacío conserva el guardado.
			await this.http.patch(`/admin/accounts/${accountId}`, { alias: input.alias.trim(), solUser: input.solUser.trim() });
			return this.getAdminAccount(accountId);
		});
	}

	replaceCredential(accountId: AccountId, solPassword: string) {
		return run(async () => {
			if (!solPassword) throw new AppError("validation", "Clave vacía", { password: "Ingrese la nueva Clave SOL." });
			await this.http.post(`/admin/accounts/${accountId}/credential`, { solPassword });
			return this.getAdminAccount(accountId);
		});
	}

	setAccountActive(accountId: AccountId, active: boolean) {
		return run(async () => {
			await this.http.patch(`/admin/accounts/${accountId}/active`, { active });
			return this.getAdminAccount(accountId);
		});
	}

	async listAccountUsers(accountId: AccountId): Promise<AppUser[]> {
		return (await this.http.get<UserDto[]>(`/admin/accounts/${accountId}/users`)).map(toUser);
	}

	listAdminAccountOptions() {
		return this.http.get<{ id: AccountId; alias: string }[]>("/admin/account-options");
	}

	// ─── Programador ─────────────────────────────────────────────────────────

	async getSchedule(accountId: AccountId): Promise<ScheduleConfig> {
		try {
			const dto = await this.http.get<ScheduleDto>(`/accounts/${accountId}/schedule`);
			return { ...dto, accountId, state: toScheduleState(dto.state), pauseReason: toPauseReason(dto.pauseReason) };
		} catch (error) {
			// Cuenta sin programación guardada todavía: valores iniciales, desactivada.
			if (error instanceof AppError && error.code === "not_found") return { ...DEFAULT_SCHEDULE, accountId };
			throw error;
		}
	}

	saveSchedule(config: Omit<ScheduleConfig, "nextRuns" | "pauseReason">) {
		return run(async () => {
			// Activar exige las puertas de cron y transporte en el servidor; sin ellas responde `remote_unavailable`.
			const { accountId, ...body } = config;
			await this.http.patch(`/accounts/${accountId}/schedule`, body);
			return this.getSchedule(accountId);
		});
	}

	// ─── Usuarios y roles ────────────────────────────────────────────────────

	private async users() {
		return (await this.http.get<UserDto[]>("/users")).map(toUser);
	}

	private async findUser(userId: UserId) {
		const user = (await this.users()).find((u) => u.id === userId);
		if (!user) throw new AppError("not_found");
		return user;
	}

	async listUsers(request: ListRequest<UserFilters, UserSortColumn>): Promise<Page<AppUser>> {
		const { filters, sort } = request;
		const rows = (await this.users()).filter(
			(u) => includesNormalized(u.name, filters.name) && includesNormalized(u.email, filters.email) && includesNormalized(u.roleName, filters.roleName) && (filters.status === "all" || u.status === filters.status),
		);
		if (sort) rows.sort((a, b) => compare(a[sort.column], b[sort.column], sort.direction));
		return paginate(rows, request.page, request.pageSize);
	}

	createUser(input: UserInput) {
		return run(async () => {
			if (!input.password || input.password.length < 12) throw new AppError("validation", "Contraseña inválida", { password: "Use al menos 12 caracteres." });
			const { id } = await this.http.post<{ id: UserId }>("/users", { name: input.name.trim(), email: input.email.trim(), roleId: input.roleId, password: input.password });
			return this.findUser(id);
		});
	}

	updateUser(userId: UserId, input: UserInput) {
		return run(async () => {
			await this.http.patch(`/users/${userId}`, { name: input.name.trim(), email: input.email.trim(), roleId: input.roleId });
			return this.findUser(userId);
		});
	}

	setUserStatus(userId: UserId, status: "active" | "disabled") {
		return run(async () => {
			await this.http.patch(`/users/${userId}/status`, { status });
			return this.findUser(userId);
		});
	}

	private async roles() {
		return (await this.http.get<RoleDto[]>("/roles")).map(toRole);
	}

	private async findRole(roleId: RoleId) {
		const role = (await this.roles()).find((r) => r.id === roleId);
		if (!role) throw new AppError("not_found");
		return role;
	}

	async listRoles(request?: ListRequest<RoleFilters, RoleSortColumn>): Promise<Page<RolePermissions>> {
		const all = await this.roles();
		if (!request) return { rows: all, total: all.length, page: 1, pageSize: all.length };
		const { sort } = request;
		const rows = all.filter((r) => includesNormalized(r.name, request.filters.name));
		if (sort) rows.sort((a, b) => compare(a[sort.column], b[sort.column], sort.direction));
		return paginate(rows, request.page, request.pageSize);
	}

	private roleBody(input: RoleInput) {
		return { name: input.name.trim(), permissions: input.permissions, allAccounts: input.allAccounts, accountIds: input.allAccounts ? [] : input.accountIds };
	}

	createRole(input: RoleInput) {
		return run(async () => {
			const { id } = await this.http.post<{ id: RoleId }>("/roles", this.roleBody(input));
			return this.findRole(id);
		});
	}

	updateRole(roleId: RoleId, input: RoleInput) {
		return run(async () => {
			await this.http.patch(`/roles/${roleId}`, this.roleBody(input));
			return this.findRole(roleId);
		});
	}

	// ─── Auditoría ───────────────────────────────────────────────────────────

	/** La API entrega los eventos más recientes (hoy, los últimos 100), ya acotados a las cuentas del rol. */
	private async audit(filters: AuditFilters) {
		const days = filters.range === "7d" ? 7 : filters.range === "30d" ? 30 : null;
		const now = Date.now();
		return (await this.http.get<AuditDto[]>("/audit"))
			.map(toAudit)
			.filter(
				(e) =>
					(filters.action === "all" || e.action === filters.action) &&
					(filters.objectType === "all" || e.objectType === filters.objectType) &&
					(filters.actor === "all" || e.actor === filters.actor) &&
					(days === null || now - new Date(e.at).getTime() <= days * 86_400_000),
			);
	}

	async listAudit(request: ListRequest<AuditFilters, AuditSortColumn>): Promise<Page<AuditEntry>> {
		const rows = await this.audit(request.filters);
		const sort = request.sort ?? { column: "at" as const, direction: "desc" as const };
		rows.sort((a, b) => compare(a[sort.column], b[sort.column], sort.direction));
		return paginate(rows, request.page, request.pageSize);
	}

	exportAuditCsv(filters: AuditFilters) {
		return run(async () => {
			const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
			const lines = [["fecha_utc", "realizado_por", "accion", "elemento", "tipo", "cambio"].join(",")];
			for (const e of await this.audit(filters)) lines.push([e.at, e.actor, e.action, e.objectLabel, e.objectType, e.change].map(escape).join(","));
			return lines.join("\n");
		});
	}

	// ─── Configuraciones ─────────────────────────────────────────────────────

	listSettings(): Promise<AppSetting[]> {
		return this.http.get<AppSetting[]>("/admin/settings");
	}

	saveSettings = (values: Partial<SettingValues>) =>
		run(async () => {
			await this.http.patch("/admin/settings", { values });
			return this.listSettings();
		});

	/** Sin sesión o con la red caída no hay nada que renovar: la siguiente consulta lo informa. */
	async touchSession(): Promise<void> {
		try {
			await this.http.post("/auth/activity");
		} catch {
			// Ignorado a propósito.
		}
	}
}
