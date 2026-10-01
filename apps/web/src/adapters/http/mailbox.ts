import type {
	AccountId,
	ArchiveRun,
	ArchiveStatus,
	BoxRunProgress,
	FileId,
	InventoryCoverage,
	InventoryRun,
	IsoDateTime,
	ItemId,
	MailBox,
	MailFile,
	MailItemMetadata,
	MailboxSettings,
	RemoteReadState,
	RunId,
	SyncState,
} from "@/domain/types";

// ─── Respuestas del buzón (apps/api/openapi.yaml) ────────────────────────────

export interface MailRowDto {
	id: string;
	box: MailBox;
	remoteState: "unread" | "read";
	subject: string | null;
	sender: string | null;
	publishedAtText: string | null;
	publishedAt: string | null;
	firstSeenAt: string;
	folderCode: string | null;
	labelCode: string | null;
	labelName: string | null;
	labelColor?: string | null;
	attachmentCount: number | null;
	starred: boolean;
	urgent: boolean;
	reviewed: boolean;
	reviewedAt: string | null;
	contentStored: boolean;
	openedByUser: boolean;
}
export interface MailListDto {
	rows: MailRowDto[];
	total: number;
}
export interface RunDto {
	id: string;
	accountId?: string;
	accountAlias?: string;
	mode: string;
	scanKind?: string;
	state: string;
	startedAt: string | null;
	finishedAt: string | null;
	resumeBox: number | null;
	resumePage: number | null;
	errorCode: string | null;
	boxes: string | string[] | null;
	newMessages: number | null;
	newNotifications: number | null;
}
export interface ActivityDto {
	current: RunDto | null;
	pages: { tipoMsj: number; pagesScanned: number | string; received: number | string | null; declaredRecords: number | null; declaredPages: number | null }[];
	seen: { tipoMsj: number; seen: number | string }[];
	history: RunDto[];
}
export interface SummaryDto {
	state: string | null;
	verified: boolean;
	pendingReview: Record<MailBox, number>;
	failedFiles: number;
	newSince: string | null;
	boxes: Record<MailBox, { uniqueCount: number; unreadInSunat: number }>;
	initialLoad?: { done: boolean; active: boolean };
}
export interface FileDto {
	id: string;
	kind: "attachment" | "generated_document";
	name: string | null;
	mimeType: string | null;
	sizeBytes: number | string | null;
	state: string;
}
export interface DetailDto {
	bodyHtml: string;
	fetchedAt: string;
	files: FileDto[];
}
export interface ArchiveRunDto extends Omit<ArchiveRun, "trigger" | "state"> {
	trigger: string;
	state: string;
}
export interface ArchiveStatusDto {
	settings: MailboxSettings;
	items: ArchiveStatus["items"];
	files: ArchiveStatus["files"];
	current: ArchiveRunDto | null;
	history: ArchiveRunDto[];
}

// ─── Traducción al modelo de la interfaz ─────────────────────────────────────

const BOX_CODE: Record<MailBox, number> = { messages: 1, notifications: 2 };
const BOXES: MailBox[] = ["messages", "notifications"];
const SYNC_STATES: readonly SyncState[] = ["pending", "running", "complete", "partial", "retrying", "paused"];
export const toSyncState = (value: string | null | undefined): SyncState | null => SYNC_STATES.find((s) => s === value) ?? null;

/** SUNAT publica asuntos con entidades HTML; se muestran como texto, nunca como marcado. */
const plainText = (value: string | null): string => {
	if (!value) return "";
	if (!value.includes("&")) return value;
	return new DOMParser().parseFromString(value, "text/html").documentElement.textContent ?? value;
};

/** Con contenido guardado y SUNAT aún mostrando «no leído», la lectura quedó sin confirmar. */
export const toRemoteState = (dto: Pick<MailRowDto, "remoteState" | "contentStored">): RemoteReadState => (dto.remoteState === "unread" ? (dto.contentStored ? "unconfirmed" : "unread") : "read");

export const toMetadata = (accountId: AccountId, dto: MailRowDto, reviewer: string | null): MailItemMetadata => ({
	id: dto.id as ItemId,
	accountId,
	box: dto.box,
	subject: plainText(dto.subject) || "(sin asunto)",
	sender: dto.sender ?? "—",
	publishedAtText: dto.publishedAtText ?? "",
	publishedAt: dto.publishedAt ?? dto.firstSeenAt,
	// «00» es el valor de SUNAT para «sin etiqueta».
	tag: dto.labelCode && dto.labelCode !== "00" ? { code: dto.labelCode, name: dto.labelName ?? `Etiqueta ${dto.labelCode}`, known: dto.labelName !== null, color: dto.labelColor ?? null } : null,
	folderCode: dto.folderCode ?? "00",
	remoteState: toRemoteState(dto),
	starred: dto.starred,
	urgent: dto.urgent,
	attachmentCountDeclared: dto.attachmentCount ?? 0,
	review: { reviewed: dto.reviewed, reviewedAt: dto.reviewedAt, reviewedBy: dto.reviewed ? reviewer : null },
	openedBeforeByUser: dto.openedByUser,
	contentStored: dto.contentStored,
	firstSeenAt: dto.firstSeenAt,
});

const runBoxes = (dto: RunDto): MailBox[] => {
	let value: unknown = dto.boxes;
	if (typeof value === "string") {
		try {
			value = JSON.parse(value);
		} catch {
			value = null;
		}
	}
	const boxes = Array.isArray(value) ? BOXES.filter((b) => (value as unknown[]).includes(b)) : [];
	return boxes.length ? boxes : BOXES;
};

const ERROR_TEXT: Record<string, string> = {
	invalid_credential: "SUNAT rechazó la credencial",
	needs_credential: "la cuenta no tiene credencial",
	remote_session_expired: "la sesión de SUNAT venció",
	remote_unavailable: "SUNAT no respondió",
	schema_changed: "SUNAT respondió en un formato inesperado",
	incomplete_inventory: "el recorrido se interrumpió",
	conflict_running: "había otra operación en curso",
	paused: "la cuenta está desactivada",
};
export const errorText = (code: string | null): string => (code ? (ERROR_TEXT[code] ?? "error inesperado") : "");

/** Estado de una bandeja dentro de una consulta que recorre las bandejas en orden. */
const boxState = (run: RunDto, box: MailBox): SyncState => {
	const state = toSyncState(run.state) ?? "pending";
	if (state === "complete" || run.resumeBox === null) return state === "running" ? "complete" : state;
	if (BOX_CODE[box] < run.resumeBox) return "complete";
	if (BOX_CODE[box] > run.resumeBox) return "pending";
	return state;
};

const resultText = (dto: RunDto, state: SyncState): string => {
	if (state === "pending") return "En cola";
	if (state === "running") return "En curso";
	if (state === "complete") {
		const fresh = Number(dto.newMessages ?? 0) + Number(dto.newNotifications ?? 0);
		return fresh > 0 ? `${fresh} ${fresh === 1 ? "elemento nuevo" : "elementos nuevos"}` : "Sin novedades";
	}
	return `Incompleta · ${errorText(dto.errorCode) || "sin detalle"}`;
};

export const toRun = (accountId: AccountId, dto: RunDto): InventoryRun => {
	const state = toSyncState(dto.state) ?? "pending";
	const resumable = (state === "partial" || state === "paused") && dto.resumeBox !== null;
	return {
		id: dto.id as RunId,
		accountId,
		mode: dto.mode === "scheduled" || dto.mode === "test" || dto.mode === "initial" ? dto.mode : "manual",
		scanKind: dto.scanKind === "incremental" ? "incremental" : "full",
		startedAt: dto.startedAt ?? dto.finishedAt ?? new Date().toISOString(),
		finishedAt: dto.finishedAt,
		boxes: runBoxes(dto),
		state,
		pauseReason: dto.errorCode === "invalid_credential" || dto.errorCode === "needs_credential" || dto.errorCode === "remote_unavailable" ? dto.errorCode : null,
		resultText: resultText(dto, state),
		resumeFrom: resumable ? { box: dto.resumeBox === 2 ? "notifications" : "messages", page: dto.resumePage ?? 1 } : null,
		// El adaptador del servidor no ejecuta el visor de SUNAT: iniciar sesión no abre ningún elemento.
		autoOpenedFirstItem: false,
	};
};

export const toProgress = (activity: ActivityDto): BoxRunProgress[] =>
	BOXES.map((box) => {
		const run = activity.current;
		const pages = activity.pages.find((p) => Number(p.tipoMsj) === BOX_CODE[box]);
		const included = run ? runBoxes(run).includes(box) : false;
		const state: SyncState = run && included ? boxState(run, box) : "pending";
		const pagesScanned = Number(pages?.pagesScanned ?? 0);
		const found = Number(pages?.received ?? 0);
		const seen = Number(activity.seen.find((s) => Number(s.tipoMsj) === BOX_CODE[box])?.seen ?? 0);
		const unique = included ? Math.min(seen, found) : 0;
		const failed = Boolean(run?.errorCode) && state !== "complete" && state !== "pending";
		return {
			box,
			state,
			pagesScanned,
			// El total de páginas que declara SUNAT no es fiable: solo orienta mientras corre.
			estimatedPages: state === "complete" ? pagesScanned : (pages?.declaredPages ?? null),
			found,
			unique,
			duplicatesSkipped: Math.max(0, found - unique),
			attachmentsStored: 0,
			errors: failed ? 1 : 0,
			errorText: failed ? errorText(run?.errorCode ?? null) : null,
			declaredMatches: state === "complete" && pages?.declaredRecords != null ? pages.declaredRecords === unique : null,
		};
	});

export const toCoverage = (summary: SummaryDto, activity: ActivityDto, box: MailBox): InventoryCoverage => {
	const progress = toProgress(activity).find((p) => p.box === box)!;
	const pages = activity.pages.find((p) => Number(p.tipoMsj) === BOX_CODE[box]);
	return {
		state: activity.current ? progress.state : null,
		uniqueCount: summary.boxes[box].uniqueCount,
		verified: summary.verified && progress.state === "complete",
		pagesScanned: progress.pagesScanned,
		estimatedPages: progress.estimatedPages,
		declaredBySunat: pages?.declaredRecords ?? null,
	};
};

const FILE_EXTENSION: Record<string, string> = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg", "application/zip": "zip", "text/html": "html" };

export const toFile = (dto: FileDto, storedAt: IsoDateTime): MailFile => ({
	id: dto.id as FileId,
	kind: dto.kind,
	name: dto.name ?? (dto.kind === "generated_document" ? "Documento generado" : "Archivo adjunto"),
	mimeType: dto.mimeType,
	sizeBytes: dto.sizeBytes === null ? null : Number(dto.sizeBytes),
	state: dto.state === "stored" ? { status: "stored", storedAt } : dto.state === "failed" ? { status: "failed", reason: "remote_unavailable" } : { status: "available" },
});

/** Nombre para guardar en el equipo: el anunciado por SUNAT, con la extensión del tipo verificado. */
export const downloadName = (file: MailFile): string => {
	const base = file.name.replace(/[\\/:*?"<>|]|\p{Cc}/gu, "_").trim() || "archivo";
	const extension = file.mimeType ? FILE_EXTENSION[file.mimeType] : undefined;
	return !extension || base.toLowerCase().endsWith(`.${extension}`) ? base : `${base}.${extension}`;
};

const toArchiveRun = (dto: ArchiveRunDto): ArchiveRun => ({
	...dto,
	trigger: dto.trigger === "inventory" || dto.trigger === "continue" ? dto.trigger : "manual",
	state: dto.state === "pending" || dto.state === "running" || dto.state === "complete" ? dto.state : "partial",
});

export const toArchiveStatus = (accountId: AccountId, dto: ArchiveStatusDto): ArchiveStatus => ({
	accountId,
	settings: { ...dto.settings, accountId },
	items: dto.items,
	files: dto.files,
	current: dto.current ? toArchiveRun(dto.current) : null,
	history: dto.history.map(toArchiveRun),
});
