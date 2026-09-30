/**
 * Datos 100 % ficticios para el prototipo. No contienen RUC, personas, asuntos ni
 * documentos reales. Los RUC completos solo existen dentro del adaptador y nunca
 * salen de él; la interfaz recibe versiones enmascaradas.
 */
import type {
	AccountId,
	AuditEntry,
	InventoryCoverage,
	InventoryRun,
	ItemId,
	MailBox,
	MailFile,
	Permission,
	RemoteReadState,
	RoleId,
	RunId,
	ScheduleConfig,
	SunatFolder,
	UserId,
	FileId,
	AppUserStatus,
	CredentialStatus,
	PauseReason,
	SyncState,
	BoxRunProgress,
} from "@/domain/types";

/** Contraseña de prueba de TODOS los usuarios activos del prototipo. Solo para el adaptador local. */
export const DEMO_PASSWORD = "demo";

/** Momento de referencia de los datos: 30/09/2026 10:05 en Lima (UTC-5). */
export const FIXTURE_NOW = new Date("2026-09-30T15:05:00Z");
const at = (limaDate: string, limaTime = "00:00") => new Date(`${limaDate}T${limaTime}:00-05:00`).toISOString();

export const ACCOUNT_IDS = {
	demo: "acc_7f3a2b" as AccountId,
	comercial: "acc_2c91e0" as AccountId,
	servicios: "acc_9d04c7" as AccountId,
	inversiones: "acc_51e8aa" as AccountId,
};

export const ROLE_IDS = {
	admin: "rol_admin" as RoleId,
	supervisor: "rol_super" as RoleId,
	analyst: "rol_analista" as RoleId,
	readonly: "rol_consulta" as RoleId,
};

// ─── Roles y usuarios ────────────────────────────────────────────────────────

export interface RoleRecord {
	id: RoleId;
	name: string;
	permissions: Permission[];
	allAccounts: boolean;
	accountIds: AccountId[];
}

export const ROLES: RoleRecord[] = [
	{
		id: ROLE_IDS.admin,
		name: "Administrador",
		permissions: ["view_mailbox", "read_content", "download_file", "mark_reviewed", "run_inventory", "view_audit", "configure_schedule", "manage_accounts", "manage_users_roles"],
		allAccounts: true,
		accountIds: [],
	},
	{
		id: ROLE_IDS.supervisor,
		name: "Supervisor",
		permissions: ["view_mailbox", "read_content", "download_file", "mark_reviewed", "run_inventory", "configure_schedule"],
		allAccounts: true,
		accountIds: [],
	},
	{
		id: ROLE_IDS.analyst,
		name: "Analista",
		permissions: ["view_mailbox", "read_content", "download_file", "mark_reviewed", "run_inventory"],
		allAccounts: false,
		accountIds: [ACCOUNT_IDS.demo, ACCOUNT_IDS.servicios],
	},
	{
		id: ROLE_IDS.readonly,
		name: "Solo consulta",
		permissions: ["view_mailbox"],
		allAccounts: false,
		accountIds: [ACCOUNT_IDS.demo],
	},
];

export interface UserRecord {
	id: UserId;
	name: string;
	email: string;
	status: AppUserStatus;
	roleId: RoleId;
	lastActivityAt: string | null;
	readWarningEnabled: boolean;
	readWarningChangedAt: string | null;
}

export const USERS: UserRecord[] = [
	{ id: "usr_a01" as UserId, name: "Admin Demo", email: "admin@empresa-demo.test", status: "active", roleId: ROLE_IDS.admin, lastActivityAt: at("2026-09-30", "10:12"), readWarningEnabled: true, readWarningChangedAt: null },
	{ id: "usr_u01" as UserId, name: "Usuario Demo Uno", email: "usuario1@empresa-demo.test", status: "active", roleId: ROLE_IDS.supervisor, lastActivityAt: at("2026-09-30", "09:58"), readWarningEnabled: true, readWarningChangedAt: null },
	{ id: "usr_u02" as UserId, name: "Usuario Demo Dos", email: "usuario2@empresa-demo.test", status: "active", roleId: ROLE_IDS.analyst, lastActivityAt: at("2026-09-30", "09:51"), readWarningEnabled: false, readWarningChangedAt: at("2026-09-30", "09:51") },
	{ id: "usr_u03" as UserId, name: "Usuario Demo Tres", email: "usuario3@empresa-demo.test", status: "active", roleId: ROLE_IDS.analyst, lastActivityAt: at("2026-09-29", "17:40"), readWarningEnabled: true, readWarningChangedAt: null },
	{ id: "usr_u04" as UserId, name: "Usuario Demo Cuatro", email: "usuario4@empresa-demo.test", status: "invited", roleId: ROLE_IDS.analyst, lastActivityAt: null, readWarningEnabled: true, readWarningChangedAt: null },
	{ id: "usr_u05" as UserId, name: "Usuario Demo Cinco", email: "usuario5@empresa-demo.test", status: "disabled", roleId: ROLE_IDS.readonly, lastActivityAt: at("2026-08-02", "11:00"), readWarningEnabled: true, readWarningChangedAt: null },
	{ id: "usr_u06" as UserId, name: "Usuario Demo Seis", email: "usuario6@empresa-demo.test", status: "active", roleId: ROLE_IDS.readonly, lastActivityAt: at("2026-09-29", "12:00"), readWarningEnabled: true, readWarningChangedAt: null },
];

// ─── Cuentas SUNAT ───────────────────────────────────────────────────────────

export interface AccountRecord {
	id: AccountId;
	alias: string;
	/** Ficticio. Nunca se devuelve completo. */
	ruc: string;
	solUser: string | null;
	active: boolean;
	credentialStatus: CredentialStatus;
	credentialSavedAt: string | null;
	credentialRejectedAt: string | null;
	createdAt: string;
	schedule: Omit<ScheduleConfig, "nextRuns">;
	lastRunAt: string | null;
	lastRunState: SyncState | null;
	folders: Record<MailBox, SunatFolder[]>;
	coverage: Record<MailBox, InventoryCoverage>;
	progress: Record<MailBox, BoxRunProgress>;
	runs: InventoryRun[];
	failedDownloads: number;
	newSinceLastRun: { messages: number; notifications: number };
}

const schedule = (
	accountId: AccountId,
	partial: Partial<Omit<ScheduleConfig, "nextRuns" | "accountId">>,
): Omit<ScheduleConfig, "nextRuns"> => ({
	accountId,
	state: "active",
	frequency: "1h",
	days: ["mon", "tue", "wed", "thu", "fri"],
	windowStart: "07:00",
	windowEnd: "20:00",
	boxes: ["messages", "notifications"],
	downloadReadAttachments: false,
	notifyInApp: true,
	notifyDailyEmail: false,
	remoteEffectAccepted: true,
	pauseReason: null,
	...partial,
});

const coverage = (state: SyncState | null, unique: number, verified: boolean, pages: number, estimated: number | null, declared: number | null): InventoryCoverage => ({
	state,
	uniqueCount: unique,
	verified,
	pagesScanned: pages,
	estimatedPages: estimated,
	declaredBySunat: declared,
});

const progress = (box: MailBox, p: Partial<BoxRunProgress>): BoxRunProgress => ({
	box,
	state: "complete",
	pagesScanned: 0,
	estimatedPages: null,
	found: 0,
	unique: 0,
	duplicatesSkipped: 0,
	attachmentsStored: 0,
	errors: 0,
	errorText: null,
	declaredMatches: null,
	...p,
});

let runSeq = 100;
const run = (accountId: AccountId, p: Partial<InventoryRun> & Pick<InventoryRun, "startedAt" | "state" | "resultText">): InventoryRun => ({
	id: `run_${runSeq++}` as RunId,
	accountId,
	mode: "scheduled",
	finishedAt: p.startedAt,
	boxes: ["messages", "notifications"],
	pauseReason: null,
	resumeFrom: null,
	autoOpenedFirstItem: false,
	...p,
});

export const buildAccounts = (): AccountRecord[] => [
	{
		id: ACCOUNT_IDS.demo,
		alias: "Contribuyente Demo S.A.C.",
		ruc: "20000000001",
		solUser: "DEMOUSR1",
		active: true,
		credentialStatus: "valid",
		credentialSavedAt: at("2026-09-01", "09:00"),
		credentialRejectedAt: null,
		createdAt: at("2026-09-01", "08:40"),
		schedule: schedule(ACCOUNT_IDS.demo, {}),
		lastRunAt: at("2026-09-30", "10:00"),
		lastRunState: "complete",
		folders: {
			messages: [
				{ code: "00", name: "Bandeja principal", count: 842, locked: false },
				{ code: "03", name: "Órdenes de Pago", count: 192, locked: true },
			],
			notifications: [{ code: "00", name: "Bandeja principal", count: 124, locked: false }],
		},
		coverage: {
			messages: coverage("complete", 1034, true, 42, 42, 1000),
			notifications: coverage("complete", 124, true, 5, 5, 124),
		},
		progress: {
			messages: progress("messages", { pagesScanned: 42, estimatedPages: 42, found: 1050, unique: 1034, duplicatesSkipped: 16, attachmentsStored: 211, declaredMatches: false }),
			notifications: progress("notifications", { pagesScanned: 5, estimatedPages: 5, found: 124, unique: 124, attachmentsStored: 41, declaredMatches: true }),
		},
		runs: [
			run(ACCOUNT_IDS.demo, { startedAt: at("2026-09-30", "10:00"), finishedAt: at("2026-09-30", "10:01"), state: "complete", resultText: "2 mensajes, 1 notificación nuevos · 48 s" }),
			run(ACCOUNT_IDS.demo, { startedAt: at("2026-09-30", "09:00"), finishedAt: at("2026-09-30", "09:01"), state: "complete", resultText: "Sin novedades · 41 s" }),
			run(ACCOUNT_IDS.demo, { startedAt: at("2026-09-30", "08:00"), finishedAt: at("2026-09-30", "08:01"), state: "complete", resultText: "SUNAT abrió el primer elemento al ingresar", autoOpenedFirstItem: true }),
			run(ACCOUNT_IDS.demo, { startedAt: at("2026-09-30", "07:00"), finishedAt: at("2026-09-30", "07:05"), state: "complete", resultText: "SUNAT no respondió · reintento 07:05 correcto" }),
			run(ACCOUNT_IDS.demo, { startedAt: at("2026-09-26", "08:15"), finishedAt: at("2026-09-26", "08:21"), state: "partial", boxes: ["notifications"], resultText: "124 únicos · 2 adjuntos con error" }),
		],
		failedDownloads: 2,
		newSinceLastRun: { messages: 2, notifications: 1 },
	},
	{
		id: ACCOUNT_IDS.comercial,
		alias: "Comercial Ejemplo E.I.R.L.",
		ruc: "10000000002",
		solUser: "DEMOUSR2",
		active: true,
		credentialStatus: "rejected",
		credentialSavedAt: at("2026-09-12", "10:00"),
		credentialRejectedAt: at("2026-09-30", "08:00"),
		createdAt: at("2026-09-12", "09:30"),
		schedule: schedule(ACCOUNT_IDS.comercial, { state: "paused", pauseReason: "invalid_credential" }),
		lastRunAt: at("2026-09-30", "08:00"),
		lastRunState: "paused",
		folders: {
			messages: [{ code: "00", name: "Bandeja principal", count: 514, locked: false }],
			notifications: [{ code: "00", name: "Bandeja principal", count: 124, locked: false }],
		},
		coverage: {
			messages: coverage("paused", 514, false, 22, 40, 980),
			notifications: coverage("complete", 124, true, 5, 5, 124),
		},
		progress: {
			messages: progress("messages", { state: "paused", pagesScanned: 22, estimatedPages: 40, found: 528, unique: 514, duplicatesSkipped: 14, attachmentsStored: 87, errors: 1, errorText: "Credencial rechazada al pedir la página 23." }),
			notifications: progress("notifications", { pagesScanned: 5, estimatedPages: 5, found: 124, unique: 124, attachmentsStored: 41, declaredMatches: true }),
		},
		runs: [
			run(ACCOUNT_IDS.comercial, {
				startedAt: at("2026-09-30", "08:00"),
				finishedAt: at("2026-09-30", "08:06"),
				state: "paused",
				pauseReason: "invalid_credential",
				boxes: ["messages"],
				resultText: "Páginas 1–22 de ~40 · 514 únicos",
				resumeFrom: { box: "messages", page: 23 },
			}),
			run(ACCOUNT_IDS.comercial, { startedAt: at("2026-09-29", "18:02"), finishedAt: at("2026-09-29", "18:10"), state: "complete", resultText: "638 únicos · 0 errores" }),
		],
		failedDownloads: 0,
		newSinceLastRun: { messages: 0, notifications: 0 },
	},
	{
		id: ACCOUNT_IDS.servicios,
		alias: "Servicios Ficticios S.R.L.",
		ruc: "20000000003",
		solUser: "DEMOUSR3",
		active: true,
		credentialStatus: "valid",
		credentialSavedAt: at("2026-09-05", "11:00"),
		credentialRejectedAt: null,
		createdAt: at("2026-09-05", "10:50"),
		schedule: schedule(ACCOUNT_IDS.servicios, { frequency: "4h", days: ["mon", "tue", "wed", "thu", "fri", "sat"] }),
		lastRunAt: at("2026-09-30", "08:00"),
		lastRunState: "partial",
		folders: { messages: [], notifications: [] },
		// Caso real anonimizado del contrato: SUNAT declara 2681 registros / 108 páginas,
		// pero hay 134 páginas con datos y 3328 filas únicas.
		coverage: {
			messages: coverage("complete", 3328, true, 135, 135, 2681),
			notifications: coverage("partial", 150, false, 6, 10, 227),
		},
		progress: {
			messages: progress("messages", { pagesScanned: 135, estimatedPages: 135, found: 3350, unique: 3328, duplicatesSkipped: 22, attachmentsStored: 402, declaredMatches: false }),
			notifications: progress("notifications", { state: "partial", pagesScanned: 6, estimatedPages: 10, found: 150, unique: 150, attachmentsStored: 12, errors: 1, errorText: "SUNAT no respondió al pedir la página 7." }),
		},
		runs: [
			run(ACCOUNT_IDS.servicios, {
				startedAt: at("2026-09-30", "08:00"),
				finishedAt: at("2026-09-30", "08:09"),
				state: "partial",
				pauseReason: "remote_unavailable",
				boxes: ["notifications"],
				resultText: "Páginas 1–6 de ~10 · 150 únicos",
				resumeFrom: { box: "notifications", page: 7 },
			}),
			run(ACCOUNT_IDS.servicios, { startedAt: at("2026-09-30", "04:00"), finishedAt: at("2026-09-30", "04:12"), state: "complete", boxes: ["messages"], resultText: "3 328 únicos · SUNAT declara 2 681" }),
		],
		failedDownloads: 0,
		newSinceLastRun: { messages: 0, notifications: 0 },
	},
	{
		id: ACCOUNT_IDS.inversiones,
		alias: "Inversiones Muestra S.A.",
		ruc: "20000000004",
		solUser: null,
		active: true,
		credentialStatus: "missing",
		credentialSavedAt: null,
		credentialRejectedAt: null,
		createdAt: at("2026-09-27", "11:20"),
		schedule: schedule(ACCOUNT_IDS.inversiones, { state: "disabled", pauseReason: "needs_credential", remoteEffectAccepted: false }),
		lastRunAt: null,
		lastRunState: null,
		folders: { messages: [], notifications: [] },
		coverage: { messages: coverage(null, 0, false, 0, null, null), notifications: coverage(null, 0, false, 0, null, null) },
		progress: {
			messages: progress("messages", { state: "pending" }),
			notifications: progress("notifications", { state: "pending" }),
		},
		runs: [],
		failedDownloads: 0,
		newSinceLastRun: { messages: 0, notifications: 0 },
	},
];

// ─── Elementos de las bandejas ───────────────────────────────────────────────

export const TAGS: Record<string, string> = {
	"01": "Valores",
	"02": "Resoluciones de Cobranza",
	"03": "Fraccionamiento",
	"04": "Fiscalización",
	"05": "Avisos",
	"06": "Cartas",
};
/** Código no presente en el catálogo conocido: la fila se conserva con etiqueta neutra. */
export const UNKNOWN_TAG = { code: "31", name: "Comunicaciones de Devolución" };

export interface ItemRecord {
	id: ItemId;
	accountId: AccountId;
	box: MailBox;
	subject: string;
	sender: string;
	publishedAtText: string;
	publishedAt: string;
	tagCode: string | null;
	folderCode: string;
	remoteState: RemoteReadState;
	starred: boolean;
	urgent: boolean;
	attachmentCountDeclared: number;
	firstSeenAt: string;
	isNew: boolean;
	/** Contenido guardado en el backend tras una lectura previa. */
	storedBody: string | null;
	files: MailFile[];
	/** Si al leer, SUNAT no confirma el cambio de estado (caso «Sin confirmar»). */
	neverConfirms?: boolean;
}

/** PRNG determinista (mulberry32) para que los fixtures sean estables entre recargas y tests. */
const prng = (seed: number) => () => {
	seed |= 0;
	seed = (seed + 0x6d2b79f5) | 0;
	let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const SENDERS = ["SUNAT", "SUNAT · Intendencia Demo", "SUNAT · Oficina Zonal Ejemplo", "SUNAT · Fiscalización Ejemplo"];
const SUBJECTS: [string, string | null][] = [
	["Resolución de Cobranza N.° 000-000-DEMO-{n}", "02"],
	["Valor emitido — Orden de pago N.° 000-DEMO-{n}", "01"],
	["Aviso: vencimiento próximo de obligación mensual (ejemplo {n})", "05"],
	["Carta inductiva de ejemplo N.° DEMO-{n}", "06"],
	["Aprobación de fraccionamiento — expediente DEMO-{n}", "03"],
	["Requerimiento de información ficticio N.° {n}-DEMO", "04"],
	["Constancia de presentación (ejemplo {n})", null],
	["Aviso informativo general (ejemplo {n})", "05"],
	["Comunicación de devolución de ejemplo {n}", UNKNOWN_TAG.code],
];

const pad = (value: number, size: number) => String(value).padStart(size, "0");

const limaText = (date: Date) => {
	const lima = new Date(date.getTime() - 5 * 3_600_000);
	return {
		day: `${pad(lima.getUTCDate(), 2)}/${pad(lima.getUTCMonth() + 1, 2)}/${lima.getUTCFullYear()}`,
		time: `${pad(lima.getUTCHours(), 2)}:${pad(lima.getUTCMinutes(), 2)}:${pad(lima.getUTCSeconds(), 2)}`,
	};
};

/** Cuerpo ficticio con script y estilo remoto de ejemplo: debe llegar saneado a la interfaz. */
export const sampleBody = (subject: string) => `
<p>Señor contribuyente:</p>
<p>Texto ficticio de ejemplo. Se le comunica el documento indicado en el asunto «${subject.replace(/[<>&"]/g, "")}», cuyo detalle se encuentra en la sección de documentos. Este contenido reemplaza al cuerpo HTML original para fines de prototipo.</p>
<p>El cuerpo se presenta con tipografía de lectura, ancho máximo de 72 caracteres y sin estilos ni scripts externos.</p>
<p><strong>Intendencia Demo</strong></p>
<script>window.__remoteScript = true;</script>
<p style="position:fixed;inset:0;background:red" onclick="alert(1)">Párrafo con estilo remoto que se descarta.</p>`;

let fileSeq = 1;
const makeFiles = (itemId: string, count: number, rnd: () => number, box: MailBox): MailFile[] => {
	const files: MailFile[] = [];
	if (box === "notifications") {
		files.push({ id: `fil_${fileSeq++}` as FileId, kind: "generated_document", name: `documento-${itemId.slice(-4)}.pdf`, mimeType: "application/pdf", sizeBytes: 150_000 + Math.floor(rnd() * 80_000), state: { status: "available" } });
	}
	for (let i = 0; i < count; i++) {
		files.push({ id: `fil_${fileSeq++}` as FileId, kind: "attachment", name: `adjunto-${itemId.slice(-4)}-${i + 1}.pdf`, mimeType: "application/pdf", sizeBytes: 90_000 + Math.floor(rnd() * 300_000), state: { status: "available" } });
	}
	return files;
};

export interface GenerateOptions {
	accountId: AccountId;
	box: MailBox;
	count: number;
	unread: number;
	seed: number;
	folders: string[];
	/** Filas iniciales definidas a mano (las más recientes). */
	head?: Partial<ItemRecord>[];
	/** Desplazamiento de IDs al completar un barrido parcial. */
	idOffset?: number;
	/** Genera fechas anteriores a esta (ISO). */
	startBefore?: string | undefined;
}

export const generateItems = ({ accountId, box, count, unread, seed, folders, head = [], idOffset = 0, startBefore }: GenerateOptions): ItemRecord[] => {
	const rnd = prng(seed);
	const items: ItemRecord[] = [];
	const start = startBefore ? new Date(startBefore).getTime() : new Date("2026-09-30T14:00:00Z").getTime();
	let cursor = start;
	for (let i = 0; i < count; i++) {
		cursor -= Math.floor(3_600_000 * (4 + rnd() * 30));
		const date = new Date(cursor);
		const { day, time } = limaText(date);
		const [template, tagCode] = SUBJECTS[Math.floor(rnd() * SUBJECTS.length)]!;
		const n = pad(1000 + ((seed * 7 + i * 13) % 9000), 4);
		const subject = template.replace("{n}", n);
		const id = `itm_${accountId.slice(4)}${box === "messages" ? "m" : "n"}${pad(i + idOffset, 5)}` as ItemId;
		const attachments = rnd() < 0.35 ? 1 + Math.floor(rnd() * 2) : 0;
		const isUnread = i < unread;
		const base: ItemRecord = {
			id,
			accountId,
			box,
			subject,
			sender: SENDERS[Math.floor(rnd() * SENDERS.length)]!,
			publishedAtText: `${day} ${time}`,
			publishedAt: date.toISOString(),
			tagCode,
			folderCode: folders.length > 1 && rnd() < 0.18 ? folders[1]! : "00",
			remoteState: isUnread ? "unread" : "read",
			starred: rnd() < 0.05,
			urgent: isUnread && rnd() < 0.15,
			attachmentCountDeclared: attachments,
			firstSeenAt: date.toISOString(),
			isNew: false,
			storedBody: !isUnread && rnd() < 0.008 ? sampleBody(subject) : null,
			files: makeFiles(id, attachments, rnd, box),
		};
		const override = head[i];
		const files = override?.files ?? (override?.attachmentCountDeclared !== undefined ? makeFiles(id, override.attachmentCountDeclared, rnd, box) : base.files);
		items.push(override ? { ...base, ...override, files } : base);
	}
	return items;
};

const row = (subject: string, sender: string, limaDate: string, limaTime: string, extra: Partial<ItemRecord>): Partial<ItemRecord> => ({
	subject,
	sender,
	publishedAtText: `${limaDate.split("-").reverse().join("/")} ${limaTime}:00`,
	publishedAt: at(limaDate, limaTime),
	firstSeenAt: at(limaDate, limaTime),
	...extra,
});

export const buildItems = (): ItemRecord[] => {
	const demoMessages = generateItems({
		accountId: ACCOUNT_IDS.demo,
		box: "messages",
		count: 1034,
		unread: 12,
		seed: 11,
		folders: ["00", "03"],
		head: [
			row("Resolución de Cobranza N.° 000-000-DEMO-01", "SUNAT · Intendencia Demo", "2026-09-28", "10:14", { tagCode: "02", starred: true, urgent: true, attachmentCountDeclared: 1, isNew: true, firstSeenAt: at("2026-09-30", "10:00") }),
			row("Aviso: vencimiento próximo de obligación mensual (ejemplo)", "SUNAT", "2026-09-25", "08:30", { tagCode: "05", starred: false, urgent: false, attachmentCountDeclared: 0, files: [], isNew: true, firstSeenAt: at("2026-09-30", "10:00") }),
			row("Valor emitido — Orden de pago N.° 000-DEMO-17 (copia)", "SUNAT · Oficina Zonal Ejemplo", "2026-09-27", "16:02", { tagCode: "01", starred: false, urgent: false }),
			{},
			{},
			{},
			{},
			{},
			{},
			{},
			{},
			{},
			row("Carta inductiva de ejemplo N.° DEMO-0042", "SUNAT · Intendencia Demo", "2026-09-22", "09:10", { tagCode: "06", remoteState: "read", storedBody: null }),
			row("Aprobación de fraccionamiento — expediente DEMO-2026", "SUNAT", "2026-09-19", "11:45", { tagCode: "03", remoteState: "read", starred: true }),
			row("Comunicación de devolución (etiqueta nueva de ejemplo)", "SUNAT", "2026-09-11", "15:20", { tagCode: UNKNOWN_TAG.code, remoteState: "read" }),
		],
	});
	const demoNotifications = generateItems({
		accountId: ACCOUNT_IDS.demo,
		box: "notifications",
		count: 124,
		unread: 3,
		seed: 23,
		folders: ["00"],
		head: [
			row("Valor emitido — Orden de pago N.° 000-DEMO-17", "SUNAT · Oficina Zonal Ejemplo", "2026-09-27", "16:02", {
				tagCode: "01",
				isNew: true,
				firstSeenAt: at("2026-09-30", "10:00"),
				attachmentCountDeclared: 2,
				files: [
					{ id: "fil_d17a" as FileId, kind: "generated_document", name: "orden-pago-DEMO-17.pdf", mimeType: "application/pdf", sizeBytes: 188_416, state: { status: "available" } },
					{ id: "fil_d17b" as FileId, kind: "attachment", name: "anexos-DEMO.zip", mimeType: "application/zip", sizeBytes: 1_258_291, state: { status: "available" } },
					{ id: "fil_d17c" as FileId, kind: "attachment", name: "constancia-DEMO.xml", mimeType: "application/xml", sizeBytes: 12_288, state: { status: "stored", storedAt: at("2026-09-29", "12:00") } },
				],
			}),
			row("Resolución de ejemplo notificada N.° 000-000-DEMO-00", "SUNAT · Intendencia Demo", "2026-09-26", "12:30", { tagCode: "02", neverConfirms: true }),
		],
	});
	const comercialMessages = generateItems({ accountId: ACCOUNT_IDS.comercial, box: "messages", count: 514, unread: 6, seed: 37, folders: ["00"] });
	const comercialNotifications = generateItems({ accountId: ACCOUNT_IDS.comercial, box: "notifications", count: 124, unread: 1, seed: 41, folders: ["00"] });
	const serviciosMessages = generateItems({ accountId: ACCOUNT_IDS.servicios, box: "messages", count: 3328, unread: 4, seed: 53, folders: ["00"] });
	const serviciosNotifications = generateItems({ accountId: ACCOUNT_IDS.servicios, box: "notifications", count: 150, unread: 2, seed: 59, folders: ["00"] });
	return [...demoMessages, ...demoNotifications, ...comercialMessages, ...comercialNotifications, ...serviciosMessages, ...serviciosNotifications];
};

// ─── Auditoría inicial ───────────────────────────────────────────────────────

export const buildAudit = (): AuditEntry[] => [
	{ id: "aud_09", at: at("2026-09-30", "10:12"), actor: "Admin Demo", action: "credential", objectLabel: "Comercial Ejemplo E.I.R.L.", objectType: "credential", change: "Clave SOL reemplazada (valor no registrado)" },
	{ id: "aud_08", at: at("2026-09-30", "10:12"), actor: "Admin Demo", action: "enable", objectLabel: "Programador · Comercial Ejemplo", objectType: "schedule", change: "En pausa → Activo" },
	{ id: "aud_07", at: at("2026-09-30", "09:51"), actor: "Usuario Demo Dos", action: "preference", objectLabel: "Aviso antes de abrir un no leído", objectType: "preference", change: "Activado → No volver a mostrar" },
	{ id: "aud_06", at: at("2026-09-30", "09:40"), actor: "Admin Demo", action: "update", objectLabel: "Rol Analista", objectType: "role", change: "+ Servicios Ficticios S.R.L." },
	{ id: "aud_05", at: at("2026-09-29", "17:05"), actor: "Admin Demo", action: "create", objectLabel: "Usuario Demo Cuatro", objectType: "user", change: "Rol: Analista · invitación enviada" },
	{ id: "aud_04", at: at("2026-09-29", "16:48"), actor: "Admin Demo", action: "update", objectLabel: "Programador · Servicios Ficticios", objectType: "schedule", change: "Cada 2 h → Cada 4 h" },
	{ id: "aud_03", at: at("2026-09-29", "12:30"), actor: "Admin Demo", action: "disable", objectLabel: "Usuario Demo Cinco", objectType: "user", change: "Activo → Desactivado" },
	{ id: "aud_02", at: at("2026-09-28", "09:00"), actor: "Sistema", action: "disable", objectLabel: "Programador · Comercial Ejemplo", objectType: "schedule", change: "Pausa automática: credencial rechazada" },
	{ id: "aud_01", at: at("2026-09-27", "11:20"), actor: "Admin Demo", action: "create", objectLabel: "Inversiones Muestra S.A.", objectType: "account", change: "Sin credencial · programador desactivado" },
];

export type { PauseReason };
