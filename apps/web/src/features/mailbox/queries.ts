import { useCallback, useRef, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { v4 as uuid } from "uuid";
import { useAdapter } from "@/app/adapter-context";
import { qk } from "@/app/query-keys";
import type { AppError } from "@/domain/adapter";
import type { AccountId, FileId, ItemId, ListRequest, MailBox, MailDetail, MailFile, MailItemMetadata, MailListFilters, MailSortColumn } from "@/domain/types";

export const useMailList = (accountId: AccountId, box: MailBox, request: ListRequest<MailListFilters, MailSortColumn>) => {
	const adapter = useAdapter();
	return useQuery({
		queryKey: qk.mail(accountId, box, request),
		queryFn: () => adapter.listMail(accountId, box, request),
		placeholderData: keepPreviousData,
		// «pending» es una corrida en cola o cedida a un comando del usuario: sigue llegando correo.
		refetchInterval: (query) => (["running", "pending"].includes(query.state.data?.coverage.state ?? "") ? 2000 : false),
	});
};

/** Metadatos del elemento. Nunca incluye cuerpo: abrir la ruta de detalle no llama a `readContent`. */
export const useItemMetadata = (accountId: AccountId, itemId: ItemId) => {
	const adapter = useAdapter();
	const client = useQueryClient();
	return useQuery({
		queryKey: qk.item(accountId, itemId),
		queryFn: () => adapter.getItemMetadata(accountId, itemId),
		// Usa la fila ya cargada del listado como dato inicial (sin petición extra ni detalle).
		initialData: () => {
			const lists = client.getQueriesData<{ rows: MailItemMetadata[] }>({ queryKey: qk.mailBase(accountId) });
			for (const [, page] of lists) {
				const row = page?.rows.find((r) => r.id === itemId);
				if (row) return row;
			}
			return undefined;
		},
		initialDataUpdatedAt: 0,
	});
};

const useInvalidateMail = () => {
	const client = useQueryClient();
	return (accountId: AccountId) => {
		void client.invalidateQueries({ queryKey: qk.mailBase(accountId) });
		void client.invalidateQueries({ queryKey: qk.summary(accountId) });
		void client.invalidateQueries({ queryKey: qk.session });
	};
};

/**
 * Único camino al contenido. La clave de idempotencia se genera una vez por vista: un
 * doble clic o un reintento no provocan una segunda lectura remota.
 */
export const useReadContent = (accountId: AccountId, itemId: ItemId) => {
	const adapter = useAdapter();
	const client = useQueryClient();
	const invalidate = useInvalidateMail();
	const [idempotencyKey] = useState(() => uuid());
	return useMutation<MailDetail, AppError>({
		mutationKey: ["readContent", accountId, itemId, idempotencyKey],
		mutationFn: async () => {
			const result = await adapter.readContent(accountId, itemId, idempotencyKey);
			if (!result.ok) throw result.error;
			return result.data;
		},
		onSuccess: (detail) => {
			client.setQueryData<MailItemMetadata>(qk.item(accountId, itemId), (prev) => (prev ? { ...prev, remoteState: detail.remoteState, openedBeforeByUser: true, contentStored: true } : prev));
			invalidate(accountId);
		},
	});
};

/** Sondeo del estado remoto mientras SUNAT confirma la lectura. */
export const useRemoteStatePolling = (accountId: AccountId, itemId: ItemId, active: boolean) => {
	const adapter = useAdapter();
	const client = useQueryClient();
	const invalidate = useInvalidateMail();
	return useQuery({
		queryKey: [...qk.item(accountId, itemId), "remote-state"],
		queryFn: async () => {
			const state = await adapter.getRemoteState(accountId, itemId);
			client.setQueryData<MailItemMetadata>(qk.item(accountId, itemId), (prev) => (prev ? { ...prev, remoteState: state } : prev));
			if (state !== "confirming") invalidate(accountId);
			return state;
		},
		enabled: active,
		refetchInterval: (query) => (query.state.data === "confirming" || query.state.data === undefined ? 1000 : false),
		gcTime: 0,
	});
};

export const useSetReviewed = (accountId: AccountId, itemId: ItemId) => {
	const adapter = useAdapter();
	const client = useQueryClient();
	const invalidate = useInvalidateMail();
	return useMutation<MailItemMetadata, AppError, boolean>({
		mutationFn: async (reviewed) => {
			const result = await adapter.setReviewed(accountId, itemId, reviewed);
			if (!result.ok) throw result.error;
			return result.data;
		},
		onSuccess: (item) => {
			client.setQueryData(qk.item(accountId, itemId), item);
			invalidate(accountId);
		},
	});
};

/** Descargas por archivo con progreso local. */
export const useDownloads = (accountId: AccountId, itemId: ItemId) => {
	const adapter = useAdapter();
	const [states, setStates] = useState<Record<string, MailFile["state"]>>({});
	const busy = useRef(new Set<string>());

	const download = useCallback(
		async (fileId: FileId) => {
			if (busy.current.has(fileId)) return;
			busy.current.add(fileId);
			setStates((s) => ({ ...s, [fileId]: { status: "downloading", progress: 0 } }));
			const result = await adapter.downloadFile(accountId, itemId, fileId, (progress) => setStates((s) => ({ ...s, [fileId]: { status: "downloading", progress } })));
			busy.current.delete(fileId);
			setStates((s) => ({
				...s,
				[fileId]: result.ok ? result.data.state : { status: "failed", reason: result.error.code === "forbidden" ? "forbidden" : "remote_unavailable" },
			}));
		},
		[adapter, accountId, itemId],
	);

	return { states, download };
};

export interface BulkReadProgress {
	total: number;
	done: number;
	failed: number;
	current: string | null;
	stopped: boolean;
	finished: boolean;
}

/** Lectura múltiple explícita: uno por uno, con posibilidad de detener. */
export const useBulkRead = (accountId: AccountId) => {
	const adapter = useAdapter();
	const invalidate = useInvalidateMail();
	const stopRef = useRef(false);
	const [progress, setProgress] = useState<BulkReadProgress | null>(null);

	const run = useCallback(
		async (items: Pick<MailItemMetadata, "id" | "subject">[]) => {
			stopRef.current = false;
			let done = 0;
			let failed = 0;
			setProgress({ total: items.length, done, failed, current: null, stopped: false, finished: false });
			for (const item of items) {
				if (stopRef.current) break;
				setProgress({ total: items.length, done, failed, current: item.subject, stopped: false, finished: false });
				const result = await adapter.readContent(accountId, item.id, uuid());
				if (result.ok) done++;
				else failed++;
			}
			setProgress({ total: items.length, done, failed, current: null, stopped: stopRef.current, finished: true });
			invalidate(accountId);
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[adapter, accountId],
	);

	return { progress, run, stop: () => (stopRef.current = true), reset: () => setProgress(null) };
};
