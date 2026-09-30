import {
	AppError,
	type AccountFilters,
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
import type {
	AccountActivity,
	AccountId,
	AdminAccount,
	AppSession,
	AppUser,
	AuditEntry,
	AuditFilters,
	BoxSummary,
	ConnectionStatus,
	FileId,
	InventoryRun,
	ItemId,
	ListRequest,
	LocalReviewState,
	MailBox,
	MailDetail,
	MailFile,
	MailItemMetadata,
	MailListFilters,
	MailPage,
	MailSortColumn,
	MailboxSummary,
	Page,
	PendingIssue,
	Permission,
	RemoteReadState,
	RoleId,
	RolePermissions,
	RunId,
	ScheduleConfig,
	SortDirection,
	SunatFolder,
	SunatTag,
	UserId,
	VisibleAccount,
} from "@/domain/types";
import { formatCount, limaDayKey } from "@/lib/format";
import { includesNormalized, normalizeText } from "@/lib/text";
import { SUNAT_GATES } from "@/lib/sunat-gates";
import { sanitizeRemoteHtml } from "@/lib/sanitize";
import { computeNextRuns, scheduleSummaryText } from "@/lib/schedule";
import {
	buildAccounts,
	buildAudit,
	buildItems,
	DEMO_PASSWORD,
	generateItems,
	ROLES,
	sampleBody,
	TAGS,
	UNKNOWN_TAG,
	USERS,
	type AccountRecord,
	type ItemRecord,
	type RoleRecord,
	type UserRecord,
} from "./fixtures";

export interface LocalAdapterOptions {
	/** Latencia simulada por petición (ms). 0 en pruebas. */
	latencyMs?: number;
	/** Intervalo del barrido simulado (ms). */
	tickMs?: number;
	/** Demora hasta que SUNAT «confirma» la lectura (ms). */
	confirmDelayMs?: number;
	/** Almacenamiento del ID de usuario de la sesión de prototipo. */
	storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
	/** Usuario con sesión iniciada al crear el adaptador (pruebas). */
	initialUserEmail?: string;
}

/** Contadores observables para pruebas: permiten afirmar qué llamadas «remotas» ocurrieron. */
export interface LocalAdapterStats {
	remoteDetailCalls: number;
	readContentCalls: number;
	readIntents: { itemId: ItemId; userId: UserId; at: string }[];
	downloads: number;
}

const SESSION_KEY = "buzon-sol:prototype-session";
const ok = <T>(data: T): CommandResult<T> => ({ ok: true, data });
const fail = <T>(error: unknown): CommandResult<T> => ({
	ok: false,
	error: error instanceof AppError ? error : new AppError("remote_unavailable", String(error)),
});

const compare = (a: string | number, b: string | number, direction: SortDirection) => {
	const result = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), "es-PE", { sensitivity: "base" });
	return direction === "asc" ? result : -result;
};

const paginate = <T>(rows: T[], page: number, pageSize: number): Page<T> => {
	const safeSize = Math.max(1, pageSize);
	const lastPage = Math.max(1, Math.ceil(rows.length / safeSize));
	const safePage = Math.min(Math.max(1, page), lastPage);
	return { rows: rows.slice((safePage - 1) * safeSize, safePage * safeSize), total: rows.length, page: safePage, pageSize: safeSize };
};

const maskRuc = (ruc: string) => `${ruc.slice(0, 2)}•••••••${ruc.slice(-2)}`;
const maskSolUser = (user: string | null) => (user ? `${user.slice(0, 4)}•••${user.slice(-1)}` : null);

const safeStorage = (): LocalAdapterOptions["storage"] => {
	try {
		return typeof window !== "undefined" ? window.sessionStorage : null;
	} catch {
		return null;
	}
};

export class LocalAdapter implements BuzonAdapter {
	readonly stats: LocalAdapterStats = { remoteDetailCalls: 0, readContentCalls: 0, readIntents: [], downloads: 0 };

	private readonly latencyMs: number;
	private readonly tickMs: number;
	private readonly confirmDelayMs: number;
	private readonly storage: LocalAdapterOptions["storage"];

	private accounts: AccountRecord[] = buildAccounts();
	private items: ItemRecord[] = buildItems();
	private users: UserRecord[] = USERS.map((u) => ({ ...u }));
	private roles: RoleRecord[] = ROLES.map((r) => ({ ...r, permissions: [...r.permissions], accountIds: [...r.accountIds] }));
	private audit: AuditEntry[] = buildAudit();
	private reviews = new Map<string, LocalReviewState>();
	private opened = new Set<string>();
	private readResults = new Map<string, MailDetail>();
	private fileStates = new Map<FileId, MailFile["state"]>();
	private downloadAttempts = new Map<FileId, number>();
	private timers = new Set<ReturnType<typeof setTimeout>>();
	private currentUserId: UserId | null = null;
	private seq = 1;

	constructor(options: LocalAdapterOptions = {}) {
		this.latencyMs = options.latencyMs ?? 250;
		this.tickMs = options.tickMs ?? 350;
		this.confirmDelayMs = options.confirmDelayMs ?? 2500;
		this.storage = options.storage === undefined ? safeStorage() : options.storage;
		if (options.initialUserEmail) {
			this.currentUserId = this.users.find((u) => u.email === options.initialUserEmail)?.id ?? null;
		} else {
			try {
				this.currentUserId = (this.storage?.getItem(SESSION_KEY) as UserId | null) ?? null;
			} catch {
				this.currentUserId = null;
			}
		}
	}

	/** Cancela temporizadores (pruebas). */
	dispose() {
		this.timers.forEach(clearTimeout);
		this.timers.clear();
	}

	// ─── Utilidades internas ──────────────────────────────────────────────────

	private wait(ms = this.latencyMs) {
		if (ms <= 0) return Promise.resolve();
		return new Promise<void>((resolve) => {
			const timer = setTimeout(() => {
				this.timers.delete(timer);
				resolve();
			}, ms);
			this.timers.add(timer);
		});
	}

	private later(ms: number, fn: () => void) {
		const timer = setTimeout(() => {
			this.timers.delete(timer);
			fn();
		}, ms);
		this.timers.add(timer);
	}

	private nextId(prefix: string) {
		return `${prefix}_${Date.now().toString(36)}${(this.seq++).toString(36)}`;
	}

	private now() {
		return new Date().toISOString();
	}

	private currentUser(): UserRecord {
		const user = this.users.find((u) => u.id === this.currentUserId);
		if (!user || user.status !== "active") throw new AppError("unauthenticated");
		return user;
	}

	private roleOf(user: UserRecord): RoleRecord {
		const role = this.roles.find((r) => r.id === user.roleId);
		if (!role) throw new AppError("forbidden");
		return role;
	}

	private requirePermission(permission: Permission) {
		const user = this.currentUser();
		const role = this.roleOf(user);
		if (!role.permissions.includes(permission)) throw new AppError("forbidden");
		return { user, role };
	}

	private roleSeesAccount(role: RoleRecord, accountId: AccountId) {
		return role.allAccounts || role.accountIds.includes(accountId);
	}

	/** Permiso Y pertenencia de la cuenta: nunca basta con el ID que envía el cliente. */
	private requireAccount(accountId: AccountId, permission: Permission) {
		const { user, role } = this.requirePermission(permission);
		const account = this.accounts.find((a) => a.id === accountId);
		if (!account || !this.roleSeesAccount(role, accountId)) throw new AppError("forbidden");
		return { user, role, account };
	}

	private requireItem(accountId: AccountId, itemId: ItemId, permission: Permission) {
		const ctx = this.requireAccount(accountId, permission);
		const item = this.items.find((i) => i.id === itemId && i.accountId === accountId);
		if (!item) throw new AppError("not_found");
		return { ...ctx, item };
	}

	private addAudit(entry: Omit<AuditEntry, "id" | "at" | "actor"> & { actor?: string }) {
		this.audit.unshift({ id: this.nextId("aud"), at: this.now(), actor: entry.actor ?? this.currentUser().name, ...entry });
	}

	private connectionOf(account: AccountRecord): ConnectionStatus {
		const running = account.runs.find((r) => r.state === "running");
		const runningBox = running ? (["messages", "notifications"] as const).find((b) => account.progress[b].state === "running") : undefined;
		return {
			scheduleState: account.schedule.state,
			syncState: running ? "running" : account.lastRunState,
			pauseReason: account.schedule.pauseReason,
			lastRunAt: account.lastRunAt,
			lastRunState: account.lastRunState,
			nextRunAt: account.active ? (computeNextRuns(account.schedule, new Date(), 1)[0] ?? null) : null,
			running:
				running && runningBox
					? { box: runningBox, page: account.progress[runningBox].pagesScanned, estimatedPages: account.progress[runningBox].estimatedPages }
					: null,
		};
	}

	private tagOf(code: string | null): SunatTag | null {
		if (!code) return null;
		const known = TAGS[code];
		if (known) return { code, name: known, known: true };
		return { code, name: code === UNKNOWN_TAG.code ? UNKNOWN_TAG.name : `Etiqueta ${code}`, known: false };
	}

	private reviewKey(userId: UserId, itemId: ItemId) {
		return `${userId}:${itemId}`;
	}

	private toMetadata(item: ItemRecord, userId: UserId): MailItemMetadata {
		return {
			id: item.id,
			accountId: item.accountId,
			box: item.box,
			subject: item.subject,
			sender: item.sender,
			publishedAtText: item.publishedAtText,
			publishedAt: item.publishedAt,
			tag: this.tagOf(item.tagCode),
			folderCode: item.folderCode,
			remoteState: item.remoteState,
			starred: item.starred,
			urgent: item.urgent,
			attachmentCountDeclared: item.attachmentCountDeclared,
			review: this.reviews.get(this.reviewKey(userId, item.id)) ?? { reviewed: false, reviewedAt: null, reviewedBy: null },
			openedBeforeByUser: this.opened.has(this.reviewKey(userId, item.id)),
			contentStored: item.storedBody !== null,
			firstSeenAt: item.firstSeenAt,
		};
	}

	private visibleAccountsFor(role: RoleRecord, user: UserRecord): VisibleAccount[] {
		return this.accounts
			.filter((a) => this.roleSeesAccount(role, a.id))
			.map((a) => ({
				id: a.id,
				alias: a.alias,
				rucMasked: maskRuc(a.ruc),
				active: a.active,
				connection: this.connectionOf(a),
				newSinceLastRun: { ...a.newSinceLastRun },
				unseenByUser: this.items.filter((i) => i.accountId === a.id && i.isNew && !this.opened.has(this.reviewKey(user.id, i.id))).length,
			}));
	}

	private buildSession(user: UserRecord): AppSession {
		const role = this.roleOf(user);
		return {
			user: this.toAppUser(user),
			permissions: [...role.permissions],
			visibleAccounts: this.visibleAccountsFor(role, user),
			preferences: { readWarningEnabled: user.readWarningEnabled, readWarningChangedAt: user.readWarningChangedAt },
		};
	}

	private toAppUser(user: UserRecord): AppUser {
		return {
			id: user.id,
			name: user.name,
			email: user.email,
			status: user.status,
			roleId: user.roleId,
			roleName: this.roles.find((r) => r.id === user.roleId)?.name ?? "—",
			lastActivityAt: user.lastActivityAt,
		};
	}

	private itemsOf(accountId: AccountId, box?: MailBox) {
		return this.items.filter((i) => i.accountId === accountId && (!box || i.box === box));
	}

	private fileState(file: MailFile): MailFile {
		return { ...file, state: this.fileStates.get(file.id) ?? file.state };
	}

	// ─── Sesión ──────────────────────────────────────────────────────────────

	async login(email: string, password: string): Promise<CommandResult<AppSession>> {
		await this.wait();
		const user = this.users.find((u) => u.email === email.trim().toLowerCase());
		// Mensaje único: no revela si el correo existe.
		if (!user || user.status !== "active" || password !== DEMO_PASSWORD) {
			return fail(new AppError("unauthenticated", "Correo o contraseña incorrectos"));
		}
		this.currentUserId = user.id;
		user.lastActivityAt = this.now();
		try {
			this.storage?.setItem(SESSION_KEY, user.id);
		} catch {
			/* sin almacenamiento: la sesión dura lo que la pestaña */
		}
		return ok(this.buildSession(user));
	}

	async logout() {
		await this.wait(0);
		this.currentUserId = null;
		try {
			this.storage?.removeItem(SESSION_KEY);
		} catch {
			/* ignorar */
		}
	}

	async getSession(): Promise<AppSession | null> {
		await this.wait(Math.min(this.latencyMs, 120));
		const user = this.users.find((u) => u.id === this.currentUserId);
		if (!user || user.status !== "active") return null;
		// Se recalcula en cada llamada: los cambios de rol/acceso aplican sin nuevo login.
		return this.buildSession(user);
	}

	async setReadWarning(enabled: boolean): Promise<CommandResult<AppSession>> {
		await this.wait();
		try {
			const user = this.currentUser();
			if (user.readWarningEnabled === enabled) return ok(this.buildSession(user));
			user.readWarningEnabled = enabled;
			user.readWarningChangedAt = this.now();
			this.addAudit({
				action: "preference",
				objectLabel: "Aviso antes de abrir un no leído",
				objectType: "preference",
				change: enabled ? "No volver a mostrar → Activado" : "Activado → No volver a mostrar",
			});
			return ok(this.buildSession(user));
		} catch (error) {
			return fail(error);
		}
	}

	// ─── Buzón ───────────────────────────────────────────────────────────────

	async getSummary(accountId: AccountId): Promise<MailboxSummary> {
		await this.wait();
		const { user, account } = this.requireAccount(accountId, "view_mailbox");
		const box = (b: MailBox): BoxSummary => {
			const items = this.itemsOf(accountId, b);
			return {
				box: b,
				coverage: { ...account.coverage[b] },
				unreadInSunat: items.filter((i) => i.remoteState === "unread").length,
				pendingReview: items.filter((i) => i.remoteState === "read" && i.storedBody !== null && !this.reviews.get(this.reviewKey(user.id, i.id))?.reviewed).length,
			};
		};
		const boxes = { messages: box("messages"), notifications: box("notifications") };
		const pending: PendingIssue[] = [];
		if (account.failedDownloads > 0) {
			pending.push({ id: "failed", kind: "failed_downloads", box: "notifications", count: account.failedDownloads, text: `${account.failedDownloads} adjuntos no se descargaron en Notificaciones del 26/09.` });
		}
		const reviewCount = boxes.messages.pendingReview + boxes.notifications.pendingReview;
		if (reviewCount > 0) {
			pending.push({ id: "review", kind: "pending_review", box: null, count: reviewCount, text: `${formatCount(reviewCount)} elementos leídos en SUNAT aún no están revisados en buzon-sol.` });
		}
		return {
			accountId,
			connection: this.connectionOf(account),
			boxes,
			newItems: this.items
				.filter((i) => i.accountId === accountId && i.isNew)
				.sort((a, b) => b.firstSeenAt.localeCompare(a.firstSeenAt))
				.map((i) => this.toMetadata(i, user.id)),
			pending,
			scheduleText: scheduleSummaryText(account.schedule),
		};
	}

	async listMail(accountId: AccountId, box: MailBox, request: ListRequest<MailListFilters, MailSortColumn>): Promise<MailPage> {
		await this.wait();
		const { user, account } = this.requireAccount(accountId, "view_mailbox");
		const { filters } = request;
		let rows = this.itemsOf(accountId, box).map((i) => this.toMetadata(i, user.id));
		rows = rows.filter((row) => {
			if (!includesNormalized(row.subject, filters.query)) return false;
			if (filters.state === "unread" && row.remoteState !== "unread") return false;
			if (filters.state === "read" && row.remoteState === "unread") return false;
			if (filters.folder && row.folderCode !== filters.folder) return false;
			if (filters.tag && row.tag?.code !== filters.tag) return false;
			if (filters.review === "reviewed" && !row.review.reviewed) return false;
			// Pendiente de revisión: ya leído y con contenido abierto, sin marca local del usuario.
			if (filters.review === "pending" && (row.review.reviewed || row.remoteState === "unread" || !row.contentStored)) return false;
			const day = limaDayKey(row.publishedAt);
			if (filters.dateFrom && day < filters.dateFrom) return false;
			if (filters.dateTo && day > filters.dateTo) return false;
			return true;
		});
		const sort = request.sort ?? { column: "publishedAt", direction: "desc" as const };
		const rank: Record<RemoteReadState, number> = { unread: 0, confirming: 1, unconfirmed: 2, read: 3 };
		rows.sort((a, b) => {
			switch (sort.column) {
				case "subject":
					return compare(a.subject, b.subject, sort.direction);
				case "sender":
					return compare(a.sender, b.sender, sort.direction);
				case "remoteState":
					return compare(rank[a.remoteState], rank[b.remoteState], sort.direction);
				default:
					return compare(a.publishedAt, b.publishedAt, sort.direction);
			}
		});
		return { ...paginate(rows, request.page, request.pageSize), coverage: { ...account.coverage[box] } };
	}

	async listFolders(accountId: AccountId, box: MailBox): Promise<SunatFolder[]> {
		await this.wait();
		const { account } = this.requireAccount(accountId, "view_mailbox");
		return account.folders[box].map((f) => ({ ...f }));
	}

	async listTags(accountId: AccountId): Promise<SunatTag[]> {
		await this.wait();
		this.requireAccount(accountId, "view_mailbox");
		const codes = [...new Set(this.itemsOf(accountId).map((i) => i.tagCode).filter((c): c is string => c !== null))];
		return codes.map((c) => this.tagOf(c)!).sort((a, b) => Number(b.known) - Number(a.known) || a.name.localeCompare(b.name, "es-PE"));
	}

	async getItemMetadata(accountId: AccountId, itemId: ItemId): Promise<MailItemMetadata> {
		await this.wait();
		const { user, item } = this.requireItem(accountId, itemId, "view_mailbox");
		return this.toMetadata(item, user.id);
	}

	async getRemoteState(accountId: AccountId, itemId: ItemId): Promise<RemoteReadState> {
		await this.wait(Math.min(this.latencyMs, 100));
		return this.requireItem(accountId, itemId, "view_mailbox").item.remoteState;
	}

	async getActivity(accountId: AccountId): Promise<AccountActivity> {
		await this.wait();
		const { account } = this.requireAccount(accountId, "view_mailbox");
		return {
			accountId,
			connection: this.connectionOf(account),
			progress: [{ ...account.progress.messages }, { ...account.progress.notifications }],
			currentRun: account.runs.find((r) => r.state === "running") ?? null,
			history: account.runs.map((r) => ({ ...r })),
		};
	}

	// ─── Comandos del buzón ──────────────────────────────────────────────────

	private assertRemoteAvailable(account: AccountRecord) {
		if (account.credentialStatus === "missing") throw new AppError("needs_credential");
		if (account.credentialStatus === "rejected") throw new AppError("invalid_credential");
		if (!account.active) throw new AppError("paused");
	}

	async startInventory(accountId: AccountId): Promise<CommandResult<InventoryRun>> {
		await this.wait();
		try {
			const { account, user } = this.requireAccount(accountId, "run_inventory");
			this.assertRemoteAvailable(account);
			if (account.runs.some((r) => r.state === "running")) throw new AppError("conflict_running");
			const run: InventoryRun = {
				id: this.nextId("run") as RunId,
				accountId,
				mode: "manual",
				startedAt: this.now(),
				finishedAt: null,
				boxes: ["messages", "notifications"],
				state: "running",
				pauseReason: null,
				resultText: "En curso",
				resumeFrom: null,
				autoOpenedFirstItem: false,
			};
			account.runs.unshift(run);
			this.addAudit({ actor: user.name, action: "update", objectLabel: account.alias, objectType: "account", change: "Inventario manual solicitado" });
			this.simulateSweep(account, run, ["messages", "notifications"], {});
			return ok({ ...run });
		} catch (error) {
			return fail(error);
		}
	}

	async resumeRun(accountId: AccountId, runId: RunId): Promise<CommandResult<InventoryRun>> {
		await this.wait();
		try {
			const { account } = this.requireAccount(accountId, "run_inventory");
			const previous = account.runs.find((r) => r.id === runId);
			if (!previous || !previous.resumeFrom) throw new AppError("not_found");
			this.assertRemoteAvailable(account);
			if (account.runs.some((r) => r.state === "running")) throw new AppError("conflict_running");
			const from = previous.resumeFrom;
			const run: InventoryRun = {
				id: this.nextId("run") as RunId,
				accountId,
				mode: "manual",
				startedAt: this.now(),
				finishedAt: null,
				boxes: [from.box],
				state: "running",
				pauseReason: null,
				resultText: `Reanudada desde pág. ${from.page}`,
				resumeFrom: null,
				autoOpenedFirstItem: false,
			};
			previous.resumeFrom = null;
			account.runs.unshift(run);
			this.simulateSweep(account, run, [from.box], { [from.box]: from.page });
			return ok({ ...run });
		} catch (error) {
			return fail(error);
		}
	}

	/** Barrido simulado por páginas con checkpoint; nunca abre detalles. */
	private simulateSweep(account: AccountRecord, run: InventoryRun, boxes: MailBox[], startPages: Partial<Record<MailBox, number>>) {
		const started = Date.now();
		const queue = [...boxes];
		account.lastRunState = "running";
		for (const box of boxes) {
			const p = account.progress[box];
			const startPage = startPages[box] ?? 1;
			const declaredPages = account.coverage[box].declaredBySunat ? Math.ceil(account.coverage[box].declaredBySunat! / 25) + 1 : null;
			const estimate = account.coverage[box].estimatedPages ?? declaredPages ?? Math.ceil(this.itemsOf(account.id, box).length / 25) + 1;
			account.progress[box] = {
				...p,
				state: "pending",
				pagesScanned: startPage - 1,
				estimatedPages: estimate,
				found: startPage === 1 ? 0 : p.found,
				unique: startPage === 1 ? 0 : p.unique,
				duplicatesSkipped: startPage === 1 ? 0 : p.duplicatesSkipped,
				errors: 0,
				errorText: null,
			};
			account.coverage[box] = { ...account.coverage[box], state: "running", verified: false };
		}
		const step = () => {
			const box = queue[0];
			if (!box) return finish();
			const p = account.progress[box];
			const estimate = p.estimatedPages ?? 1;
			const pagesPerTick = Math.max(1, Math.ceil(estimate / 20));
			p.state = "running";
			const nextPages = Math.min(estimate, p.pagesScanned + pagesPerTick);
			const itemsInBox = this.itemsOf(account.id, box).length;
			const dataPages = Math.max(1, Math.ceil(itemsInBox / 25));
			p.pagesScanned = nextPages;
			p.found = Math.min(itemsInBox + p.duplicatesSkipped, Math.min(nextPages, dataPages) * 25);
			p.unique = Math.min(itemsInBox, p.found);
			account.coverage[box] = { ...account.coverage[box], pagesScanned: nextPages };
			if (nextPages >= estimate) {
				// Página vacía confirmada (se repite): fin del barrido de esta bandeja.
				if (box === "notifications" && account.coverage.notifications.declaredBySunat && itemsInBox < account.coverage.notifications.declaredBySunat) {
					const missing = account.coverage.notifications.declaredBySunat - itemsInBox;
					this.items.push(...generateItems({ accountId: account.id, box, count: missing, unread: 0, seed: 97, folders: ["00"], idOffset: itemsInBox, startBefore: this.itemsOf(account.id, box).map((i) => i.publishedAt).sort()[0] }));
				}
				const total = this.itemsOf(account.id, box).length;
				p.state = "complete";
				p.unique = total;
				p.found = total + p.duplicatesSkipped;
				p.pagesScanned = Math.ceil(total / 25) + 1;
				p.estimatedPages = p.pagesScanned;
				p.declaredMatches = account.coverage[box].declaredBySunat === null ? null : account.coverage[box].declaredBySunat === total;
				account.coverage[box] = { state: "complete", uniqueCount: total, verified: true, pagesScanned: p.pagesScanned, estimatedPages: p.pagesScanned, declaredBySunat: account.coverage[box].declaredBySunat };
				queue.shift();
			}
			this.later(this.tickMs, step);
		};
		const finish = () => {
			const seconds = Math.max(1, Math.round((Date.now() - started) / 1000));
			run.state = "complete";
			run.finishedAt = this.now();
			run.resultText = `Sin novedades · ${seconds} s`;
			account.lastRunAt = run.finishedAt;
			account.lastRunState = "complete";
		};
		this.later(this.tickMs, step);
	}

	async readContent(accountId: AccountId, itemId: ItemId, idempotencyKey: string): Promise<CommandResult<MailDetail>> {
		this.stats.readContentCalls++;
		await this.wait();
		try {
			const { user, account, item } = this.requireItem(accountId, itemId, "read_content");
			const cached = this.readResults.get(idempotencyKey);
			if (cached) return ok({ ...cached, remoteState: item.remoteState, remoteCallMade: false });

			let remoteCallMade = false;
			let body = item.storedBody;
			if (body === null) {
				this.assertRemoteAvailable(account);
				// La intención se registra ANTES de la llamada con posible efecto remoto.
				this.stats.readIntents.push({ itemId, userId: user.id, at: this.now() });
				this.addAudit({ actor: user.name, action: "read", objectLabel: item.subject, objectType: "item", change: item.remoteState === "unread" ? "Lectura solicitada · no leído en SUNAT" : "Lectura solicitada" });
				this.stats.remoteDetailCalls++;
				remoteCallMade = true;
				body = item.storedBody = sampleBody(item.subject);
				if (item.remoteState === "unread") {
					item.remoteState = "confirming";
					this.later(this.confirmDelayMs, () => {
						item.remoteState = item.neverConfirms ? "unconfirmed" : "read";
					});
				}
			}
			this.opened.add(this.reviewKey(user.id, item.id));
			const detail: MailDetail = {
				itemId,
				accountId,
				// El backend guardará una versión segura; el visor vuelve a sanear en cliente.
				bodyHtml: sanitizeRemoteHtml(body),
				remoteCallMade,
				remoteState: item.remoteState,
				files: item.files.map((f) => this.fileState(f)),
				readEventId: this.nextId("rev"),
			};
			this.readResults.set(idempotencyKey, detail);
			return ok(detail);
		} catch (error) {
			return fail(error);
		}
	}

	async downloadFile(accountId: AccountId, itemId: ItemId, fileId: FileId, onProgress?: (progress: number) => void): Promise<CommandResult<MailFile>> {
		try {
			const { user, account, item } = this.requireItem(accountId, itemId, "download_file");
			const file = item.files.find((f) => f.id === fileId);
			if (!file) throw new AppError("not_found");
			const current = this.fileState(file);
			if (current.state.status === "stored") return ok(current);
			// Obtener el archivo exige el detalle abierto (F5 aplica F4 antes).
			if (item.storedBody === null) throw new AppError("forbidden", "Abra el contenido antes de descargar");
			this.assertRemoteAvailable(account);
			this.stats.downloads++;
			const attempts = (this.downloadAttempts.get(fileId) ?? 0) + 1;
			this.downloadAttempts.set(fileId, attempts);
			for (const progress of [8, 27, 45, 62, 80, 100]) {
				await this.wait(Math.max(this.latencyMs / 2, 0));
				// El ZIP de ejemplo falla en el primer intento para mostrar «Reintentar».
				if (file.mimeType === "application/zip" && attempts === 1 && progress >= 62) {
					this.fileStates.set(fileId, { status: "failed", reason: "remote_unavailable" });
					this.addAudit({ actor: user.name, action: "failure", objectLabel: file.name, objectType: "file", change: "Descarga fallida · SUNAT no entregó el archivo" });
					throw new AppError("remote_unavailable");
				}
				this.fileStates.set(fileId, { status: "downloading", progress });
				onProgress?.(progress);
			}
			this.fileStates.set(fileId, { status: "stored", storedAt: this.now() });
			this.addAudit({ actor: user.name, action: "download", objectLabel: file.name, objectType: "file", change: "Guardado en el espacio de la cuenta" });
			return ok(this.fileState(file));
		} catch (error) {
			return fail(error);
		}
	}

	async setReviewed(accountId: AccountId, itemId: ItemId, reviewed: boolean): Promise<CommandResult<MailItemMetadata>> {
		await this.wait();
		try {
			const { user, item } = this.requireItem(accountId, itemId, "mark_reviewed");
			// Solo estado local por usuario; nunca se envía a SUNAT ni cambia `remoteState`.
			this.reviews.set(this.reviewKey(user.id, item.id), reviewed ? { reviewed: true, reviewedAt: this.now(), reviewedBy: user.name } : { reviewed: false, reviewedAt: null, reviewedBy: null });
			return ok(this.toMetadata(item, user.id));
		} catch (error) {
			return fail(error);
		}
	}

	// ─── Administración de cuentas ───────────────────────────────────────────

	private toAdminAccount(account: AccountRecord): AdminAccount {
		return {
			id: account.id,
			alias: account.alias,
			rucMasked: maskRuc(account.ruc),
			solUserMasked: maskSolUser(account.solUser),
			active: account.active,
			credential: { status: account.credentialStatus, savedAt: account.credentialSavedAt, rejectedAt: account.credentialRejectedAt },
			connection: this.connectionOf(account),
			scheduleSummary: scheduleSummaryText(account.schedule),
			newSinceLastRun: { ...account.newSinceLastRun },
			userCount: this.users.filter((u) => u.status !== "disabled" && this.roleSeesAccount(this.roleOf(u), account.id)).length,
			createdAt: account.createdAt,
		};
	}

	async listAdminAccounts(request: ListRequest<AccountFilters, AccountSortColumn>): Promise<Page<AdminAccount>> {
		await this.wait();
		this.requirePermission("manage_accounts");
		const { filters } = request;
		let rows = this.accounts.map((a) => this.toAdminAccount(a));
		rows = rows.filter(
			(a) =>
				includesNormalized(a.alias, filters.alias) &&
				(filters.credential === "all" || a.credential.status === filters.credential) &&
				(filters.schedule === "all" || a.connection.scheduleState === filters.schedule),
		);
		if (request.sort) {
			const { column, direction } = request.sort;
			rows.sort((a, b) =>
				column === "alias" ? compare(a.alias, b.alias, direction) : column === "credential" ? compare(a.credential.status, b.credential.status, direction) : compare(a.connection.lastRunAt ?? "", b.connection.lastRunAt ?? "", direction),
			);
		}
		return paginate(rows, request.page, request.pageSize);
	}

	async getAdminAccount(accountId: AccountId): Promise<AdminAccount> {
		await this.wait();
		this.requirePermission("manage_accounts");
		const account = this.accounts.find((a) => a.id === accountId);
		if (!account) throw new AppError("not_found");
		return this.toAdminAccount(account);
	}

	async createAccount(input: AccountInput): Promise<CommandResult<AdminAccount>> {
		await this.wait();
		try {
			this.requirePermission("manage_accounts");
			if (this.accounts.some((a) => a.ruc === input.ruc)) throw new AppError("validation", "RUC duplicado", { ruc: "Ya existe una cuenta con este RUC." });
			const id = this.nextId("acc") as AccountId;
			const empty = { state: null, uniqueCount: 0, verified: false, pagesScanned: 0, estimatedPages: null, declaredBySunat: null };
			const emptyProgress = (box: MailBox) => ({ box, state: "pending" as const, pagesScanned: 0, estimatedPages: null, found: 0, unique: 0, duplicatesSkipped: 0, attachmentsStored: 0, errors: 0, errorText: null, declaredMatches: null });
			const account: AccountRecord = {
				id,
				alias: input.alias.trim(),
				ruc: input.ruc,
				solUser: input.solUser.trim().toUpperCase(),
				active: true,
				credentialStatus: "missing",
				credentialSavedAt: null,
				credentialRejectedAt: null,
				createdAt: this.now(),
				schedule: { accountId: id, state: "disabled", frequency: "1h", days: ["mon", "tue", "wed", "thu", "fri"], windowStart: "07:00", windowEnd: "20:00", boxes: ["messages", "notifications"], downloadReadAttachments: false, notifyInApp: true, notifyDailyEmail: false, remoteEffectAccepted: false, pauseReason: "needs_credential" },
				lastRunAt: null,
				lastRunState: null,
				folders: { messages: [], notifications: [] },
				coverage: { messages: { ...empty }, notifications: { ...empty } },
				progress: { messages: emptyProgress("messages"), notifications: emptyProgress("notifications") },
				runs: [],
				failedDownloads: 0,
				newSinceLastRun: { messages: 0, notifications: 0 },
			};
			this.accounts.push(account);
			this.addAudit({ action: "create", objectLabel: account.alias, objectType: "account", change: "Sin credencial · programador desactivado" });
			return ok(this.toAdminAccount(account));
		} catch (error) {
			return fail(error);
		}
	}

	async updateAccount(accountId: AccountId, input: Omit<AccountInput, "ruc">): Promise<CommandResult<AdminAccount>> {
		await this.wait();
		try {
			this.requirePermission("manage_accounts");
			const account = this.accounts.find((a) => a.id === accountId);
			if (!account) throw new AppError("not_found");
			const changes: string[] = [];
			if (account.alias !== input.alias.trim()) changes.push(`Nombre: ${account.alias} → ${input.alias.trim()}`);
			const solUser = input.solUser.trim().toUpperCase();
			if (solUser && solUser !== account.solUser) changes.push("Usuario SOL actualizado");
			account.alias = input.alias.trim();
			if (solUser) account.solUser = solUser;
			if (changes.length) this.addAudit({ action: "update", objectLabel: account.alias, objectType: "account", change: changes.join(" · ") });
			return ok(this.toAdminAccount(account));
		} catch (error) {
			return fail(error);
		}
	}

	async replaceCredential(accountId: AccountId, solPassword: string): Promise<CommandResult<AdminAccount>> {
		await this.wait();
		try {
			this.requirePermission("manage_accounts");
			const account = this.accounts.find((a) => a.id === accountId);
			if (!account) throw new AppError("not_found");
			if (solPassword.length < 1) throw new AppError("validation", "Clave vacía", { password: "Ingrese la nueva Clave SOL." });
			// El prototipo no conserva el valor: solo registra que existe una clave nueva sin probar.
			account.credentialStatus = "untested";
			account.credentialSavedAt = this.now();
			account.credentialRejectedAt = null;
			this.addAudit({ action: "credential", objectLabel: account.alias, objectType: "credential", change: "Clave SOL reemplazada (valor no registrado)" });
			return ok(this.toAdminAccount(account));
		} catch (error) {
			return fail(error);
		}
	}

	async testConnection(accountId: AccountId): Promise<CommandResult<CredentialTestResult>> {
		await this.wait(this.latencyMs * 4);
		try {
			this.requirePermission("manage_accounts");
			const account = this.accounts.find((a) => a.id === accountId);
			if (!account) throw new AppError("not_found");
			if (account.credentialStatus === "missing") throw new AppError("needs_credential");
			const accepted = account.credentialStatus !== "rejected";
			// Ejemplo de posible efecto remoto al iniciar sesión (G-02 pendiente).
			const autoOpenedFirstItem = !SUNAT_GATES.passiveLogin && account.id.endsWith("e0");
			if (accepted) {
				account.credentialStatus = "valid";
				if (account.schedule.pauseReason === "invalid_credential") {
					account.schedule = { ...account.schedule, state: "paused", pauseReason: "manual" };
				}
			} else {
				account.credentialRejectedAt = this.now();
			}
			this.addAudit({ action: "test", objectLabel: account.alias, objectType: "credential", change: `Probar conexión: ${accepted ? "SUNAT aceptó la credencial" : "SUNAT rechazó la credencial"}${autoOpenedFirstItem ? " · SUNAT abrió el primer elemento" : ""}` });
			return ok({ accepted, autoOpenedFirstItem, testedAt: this.now() });
		} catch (error) {
			return fail(error);
		}
	}

	async setAccountActive(accountId: AccountId, active: boolean): Promise<CommandResult<AdminAccount>> {
		await this.wait();
		try {
			this.requirePermission("manage_accounts");
			const account = this.accounts.find((a) => a.id === accountId);
			if (!account) throw new AppError("not_found");
			account.active = active;
			if (!active) account.schedule = { ...account.schedule, state: "disabled" };
			this.addAudit({ action: active ? "enable" : "disable", objectLabel: account.alias, objectType: "account", change: active ? "Desactivada → Activa" : "Activa → Desactivada · programador detenido, inventario conservado" });
			return ok(this.toAdminAccount(account));
		} catch (error) {
			return fail(error);
		}
	}

	async getSchedule(accountId: AccountId): Promise<ScheduleConfig> {
		await this.wait();
		const { account } = this.requireAccount(accountId, "configure_schedule");
		return { ...account.schedule, days: [...account.schedule.days], boxes: [...account.schedule.boxes], nextRuns: computeNextRuns(account.schedule, new Date()) };
	}

	async saveSchedule(config: Omit<ScheduleConfig, "nextRuns" | "pauseReason">): Promise<CommandResult<ScheduleConfig>> {
		await this.wait();
		try {
			const { account } = this.requireAccount(config.accountId, "configure_schedule");
			const fields: Record<string, string> = {};
			if (config.windowStart >= config.windowEnd) fields.windowEnd = "La hora de fin debe ser posterior a la de inicio.";
			if (config.days.length === 0) fields.days = "Elija al menos un día.";
			if (config.boxes.length === 0) fields.boxes = "Elija al menos una bandeja.";
			if (config.state === "active" && !SUNAT_GATES.passiveLogin && !config.remoteEffectAccepted) fields.remoteEffectAccepted = "Debe aceptar el posible efecto del inicio de sesión para activar la programación.";
			if (Object.keys(fields).length) throw new AppError("validation", "Programación inválida", fields);
			if (config.state === "active" && account.credentialStatus !== "valid") throw new AppError(account.credentialStatus === "rejected" ? "invalid_credential" : "needs_credential");
			const before = scheduleSummaryText(account.schedule);
			account.schedule = { ...config, pauseReason: config.state === "active" ? null : account.schedule.pauseReason };
			const after = scheduleSummaryText(account.schedule);
			this.addAudit({ action: "update", objectLabel: `Programador · ${account.alias}`, objectType: "schedule", change: before === after ? "Configuración actualizada" : `${before} → ${after}` });
			return ok({ ...account.schedule, nextRuns: computeNextRuns(account.schedule, new Date()) });
		} catch (error) {
			return fail(error);
		}
	}

	async listAccountUsers(accountId: AccountId): Promise<AppUser[]> {
		await this.wait();
		this.requirePermission("manage_accounts");
		return this.users.filter((u) => this.roleSeesAccount(this.roleOf(u), accountId)).map((u) => this.toAppUser(u));
	}

	async listScheduledRuns() {
		await this.wait();
		this.requirePermission("manage_accounts");
		return this.accounts
			.flatMap((a) => a.runs.map((r) => ({ ...r, accountAlias: a.alias })))
			.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
	}

	// ─── Usuarios y roles ────────────────────────────────────────────────────

	async listUsers(request: ListRequest<UserFilters, UserSortColumn>): Promise<Page<AppUser>> {
		await this.wait();
		this.requirePermission("manage_users_roles");
		const { filters } = request;
		let rows = this.users.map((u) => this.toAppUser(u));
		rows = rows.filter(
			(u) =>
				includesNormalized(u.name, filters.name) &&
				includesNormalized(u.email, filters.email) &&
				includesNormalized(u.roleName, filters.roleName) &&
				(filters.status === "all" || u.status === filters.status),
		);
		if (request.sort) {
			const { column, direction } = request.sort;
			rows.sort((a, b) => compare(a[column], b[column], direction));
		}
		return paginate(rows, request.page, request.pageSize);
	}

	private validateUser(input: UserInput, userId?: UserId) {
		const email = input.email.trim().toLowerCase();
		if (this.users.some((u) => u.email === email && u.id !== userId)) throw new AppError("validation", "Correo duplicado", { email: "Ya existe un usuario con este correo." });
		if (!this.roles.some((r) => r.id === input.roleId)) throw new AppError("validation", "Rol inválido", { roleId: "Elija un rol." });
		return email;
	}

	async createUser(input: UserInput): Promise<CommandResult<AppUser>> {
		await this.wait();
		try {
			this.requirePermission("manage_users_roles");
			const email = this.validateUser(input);
			const user: UserRecord = { id: this.nextId("usr") as UserId, name: input.name.trim(), email, status: "invited", roleId: input.roleId, lastActivityAt: null, readWarningEnabled: true, readWarningChangedAt: null };
			this.users.push(user);
			this.addAudit({ action: "create", objectLabel: user.name, objectType: "user", change: `Rol: ${this.roleOf(user).name} · invitación enviada` });
			return ok(this.toAppUser(user));
		} catch (error) {
			return fail(error);
		}
	}

	async updateUser(userId: UserId, input: UserInput): Promise<CommandResult<AppUser>> {
		await this.wait();
		try {
			const { user: actor } = this.requirePermission("manage_users_roles");
			const user = this.users.find((u) => u.id === userId);
			if (!user) throw new AppError("not_found");
			const email = this.validateUser(input, userId);
			if (user.id === actor.id && input.roleId !== user.roleId) throw new AppError("validation", "Rol propio", { roleId: "No puede cambiar su propio rol." });
			const changes: string[] = [];
			if (user.roleId !== input.roleId) changes.push(`Rol: ${this.roleOf(user).name} → ${this.roles.find((r) => r.id === input.roleId)!.name}`);
			if (user.name !== input.name.trim()) changes.push("Nombre actualizado");
			if (user.email !== email) changes.push("Correo actualizado");
			Object.assign(user, { name: input.name.trim(), email, roleId: input.roleId });
			if (changes.length) this.addAudit({ action: "update", objectLabel: user.name, objectType: "user", change: changes.join(" · ") });
			return ok(this.toAppUser(user));
		} catch (error) {
			return fail(error);
		}
	}

	async setUserStatus(userId: UserId, status: "active" | "disabled"): Promise<CommandResult<AppUser>> {
		await this.wait();
		try {
			const { user: actor } = this.requirePermission("manage_users_roles");
			const user = this.users.find((u) => u.id === userId);
			if (!user) throw new AppError("not_found");
			if (user.id === actor.id) throw new AppError("validation", "Usuario propio", { status: "No puede desactivar su propio usuario." });
			const label = { active: "Activo", invited: "Invitación enviada", disabled: "Desactivado" };
			const before = label[user.status];
			user.status = status;
			this.addAudit({ action: status === "active" ? "enable" : "disable", objectLabel: user.name, objectType: "user", change: `${before} → ${label[status]}` });
			return ok(this.toAppUser(user));
		} catch (error) {
			return fail(error);
		}
	}

	private toRole(role: RoleRecord): RolePermissions {
		return { ...role, permissions: [...role.permissions], accountIds: [...role.accountIds], userCount: this.users.filter((u) => u.roleId === role.id && u.status !== "disabled").length };
	}

	async listRoles(request?: ListRequest<RoleFilters, RoleSortColumn>): Promise<Page<RolePermissions>> {
		await this.wait();
		this.requirePermission("manage_users_roles");
		let rows = this.roles.map((r) => this.toRole(r));
		if (!request) return { rows, total: rows.length, page: 1, pageSize: rows.length };
		rows = rows.filter((r) => includesNormalized(r.name, request.filters.name));
		if (request.sort) {
			const { column, direction } = request.sort;
			rows.sort((a, b) => compare(a[column], b[column], direction));
		}
		return paginate(rows, request.page, request.pageSize);
	}

	private validateRole(input: RoleInput, roleId?: RoleId) {
		const fields: Record<string, string> = {};
		if (this.roles.some((r) => normalizeText(r.name) === normalizeText(input.name) && r.id !== roleId)) fields.name = "Ya existe un rol con este nombre.";
		if (!input.permissions.includes("view_mailbox") && input.permissions.some((p) => ["read_content", "download_file", "mark_reviewed", "run_inventory"].includes(p))) fields.permissions = "Las acciones del buzón requieren «Ver bandejas».";
		if (Object.keys(fields).length) throw new AppError("validation", "Rol inválido", fields);
	}

	async createRole(input: RoleInput): Promise<CommandResult<RolePermissions>> {
		await this.wait();
		try {
			this.requirePermission("manage_users_roles");
			this.validateRole(input);
			const role: RoleRecord = { id: this.nextId("rol") as RoleId, name: input.name.trim(), permissions: [...input.permissions], allAccounts: input.allAccounts, accountIds: input.allAccounts ? [] : [...input.accountIds] };
			this.roles.push(role);
			this.addAudit({ action: "create", objectLabel: `Rol ${role.name}`, objectType: "role", change: `${role.permissions.length} permisos · ${role.allAccounts ? "todas las cuentas" : `${role.accountIds.length} cuentas`}` });
			return ok(this.toRole(role));
		} catch (error) {
			return fail(error);
		}
	}

	async updateRole(roleId: RoleId, input: RoleInput): Promise<CommandResult<RolePermissions>> {
		await this.wait();
		try {
			const { user } = this.requirePermission("manage_users_roles");
			const role = this.roles.find((r) => r.id === roleId);
			if (!role) throw new AppError("not_found");
			if (role.id === user.roleId && (!input.permissions.includes("manage_users_roles") || !input.allAccounts)) {
				throw new AppError("validation", "Rol propio", { permissions: "No puede quitar a su propio rol la gestión de usuarios ni el acceso a todas las cuentas." });
			}
			this.validateRole(input, roleId);
			const added = input.accountIds.filter((id) => !role.accountIds.includes(id));
			const removed = role.accountIds.filter((id) => !input.accountIds.includes(id));
			const alias = (id: AccountId) => this.accounts.find((a) => a.id === id)?.alias ?? id;
			const changes = [
				...added.map((id) => `+ ${alias(id)}`),
				...removed.map((id) => `− ${alias(id)}`),
				...input.permissions.filter((p) => !role.permissions.includes(p)).map((p) => `+ permiso ${p}`),
				...role.permissions.filter((p) => !input.permissions.includes(p)).map((p) => `− permiso ${p}`),
			];
			if (role.allAccounts !== input.allAccounts) changes.push(input.allAccounts ? "Todas las cuentas" : "Cuentas explícitas");
			if (role.name !== input.name.trim()) changes.push(`Nombre: ${role.name} → ${input.name.trim()}`);
			Object.assign(role, { name: input.name.trim(), permissions: [...input.permissions], allAccounts: input.allAccounts, accountIds: input.allAccounts ? [] : [...input.accountIds] });
			this.addAudit({ action: "update", objectLabel: `Rol ${role.name}`, objectType: "role", change: changes.join(" · ") || "Sin cambios" });
			return ok(this.toRole(role));
		} catch (error) {
			return fail(error);
		}
	}

	async listAdminAccountOptions() {
		await this.wait();
		this.requirePermission("manage_users_roles");
		return this.accounts.map((a) => ({ id: a.id, alias: a.alias }));
	}

	// ─── Auditoría ───────────────────────────────────────────────────────────

	private filterAudit(filters: AuditFilters) {
		const now = Date.now();
		const limit = filters.range === "7d" ? 7 : filters.range === "30d" ? 30 : null;
		return this.audit.filter(
			(e) =>
				(filters.action === "all" || e.action === filters.action) &&
				(filters.objectType === "all" || e.objectType === filters.objectType) &&
				(filters.actor === "all" || e.actor === filters.actor) &&
				(limit === null || now - new Date(e.at).getTime() <= limit * 86_400_000),
		);
	}

	async listAudit(request: ListRequest<AuditFilters, AuditSortColumn>): Promise<Page<AuditEntry>> {
		await this.wait();
		this.requirePermission("view_audit");
		const rows = this.filterAudit(request.filters);
		const sort = request.sort ?? { column: "at", direction: "desc" as const };
		rows.sort((a, b) => compare(a[sort.column], b[sort.column], sort.direction));
		return paginate(rows, request.page, request.pageSize);
	}

	async exportAuditCsv(filters: AuditFilters): Promise<CommandResult<string>> {
		await this.wait();
		try {
			this.requirePermission("view_audit");
			const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
			const lines = [["fecha_utc", "realizado_por", "accion", "elemento", "tipo", "cambio"].join(",")];
			for (const e of this.filterAudit(filters)) lines.push([e.at, e.actor, e.action, e.objectLabel, e.objectType, e.change].map(escape).join(","));
			this.addAudit({ action: "download", objectLabel: "Auditoría (CSV)", objectType: "file", change: "Exportación de auditoría" });
			return ok(lines.join("\n"));
		} catch (error) {
			return fail(error);
		}
	}
}
