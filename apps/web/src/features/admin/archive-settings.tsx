import { useId, useState } from "react";
import { Button } from "lizaui/button";
import { Checkbox } from "lizaui/checkbox";
import type { AccountId, MailboxSettings } from "@/domain/types";
import { FilterSelect } from "@/components/custom/list-table";
import { BlockSkeleton, Section } from "@/components/custom/layout-bits";
import { Notice } from "@/components/custom/notice";
import { QueryError } from "@/components/custom/query-error";
import { errorCopy } from "@/lib/errors";
import { useMailboxSettings, useSaveMailboxSettings } from "./queries";

const BATCH_SIZES = [25, 50, 100, 200, 500, 1000, 2000];

/** Archivo de la cuenta: qué se guarda de los elementos que SUNAT ya lista como leídos. */
export const ArchiveSettings = ({ accountId }: { accountId: AccountId }) => {
	const settings = useMailboxSettings(accountId);
	const save = useSaveMailboxSettings();
	const [draft, setDraft] = useState<MailboxSettings | null>(null);
	const ids = { content: useId(), files: useId() };

	if (settings.isPending) return <BlockSkeleton lines={4} label="Cargando configuración del archivo" />;
	if (settings.isError) return <QueryError error={settings.error} onRetry={() => void settings.refetch()} />;

	const value = draft ?? settings.data;
	const sizes = BATCH_SIZES.includes(value.archiveBatchSize) ? BATCH_SIZES : [...BATCH_SIZES, value.archiveBatchSize].sort((a, b) => a - b);
	const change = (patch: Partial<MailboxSettings>) => {
		save.reset();
		setDraft({ ...value, ...patch });
	};
	const submit = () => save.mutate(value, { onSuccess: () => setDraft(null) });

	return (
		<Section title="Archivo del buzón">
			<p className="mb-4 text-sm text-muted-ink">
				Después de cada consulta completa, buzon-sol puede guardar el contenido de los elementos que SUNAT <strong className="text-ink-2">ya muestra como leídos</strong>. Un elemento no leído nunca se abre de forma automática: solo cuando una persona lo abre desde la bandeja.
			</p>
			<div className="flex flex-col gap-3">
				<div className="flex items-start gap-2">
					<Checkbox id={ids.content} checked={value.archiveContent} onChange={(e) => change({ archiveContent: e.target.checked, archiveFiles: e.target.checked ? value.archiveFiles : false })} />
					<label htmlFor={ids.content} className="text-sm text-ink">
						Guardar el contenido de los elementos ya leídos
						<span className="block text-xs text-muted-ink">Cada apertura queda registrada. Abrir un elemento ya leído no cambia su estado en SUNAT.</span>
					</label>
				</div>
				<div className="flex items-start gap-2">
					<Checkbox id={ids.files} checked={value.archiveFiles} disabled={!value.archiveContent} onChange={(e) => change({ archiveFiles: e.target.checked })} />
					<label htmlFor={ids.files} className="text-sm text-ink">
						Guardar también sus archivos
						<span className="block text-xs text-muted-ink">Adjuntos y documentos generados, en el espacio privado de esta cuenta.</span>
					</label>
				</div>
				<label className="flex max-w-xs flex-col gap-0.5 text-xs text-muted-ink">
					Elementos por lote
					<FilterSelect label="Elementos por lote" value={String(value.archiveBatchSize)} onChange={(v) => change({ archiveBatchSize: Number(v) })} options={sizes.map((n) => ({ value: String(n), label: `${n} por sesión de SUNAT` }))} />
				</label>
			</div>
			{save.isError && (
				<Notice tone="error" role="alert" title={errorCopy(save.error).title} className="mt-4">
					{errorCopy(save.error).body}
				</Notice>
			)}
			{save.isSuccess && !draft && (
				<Notice tone="success" className="mt-4">
					Configuración guardada. Se aplica desde la próxima consulta completa.
				</Notice>
			)}
			<div className="mt-4 flex justify-end">
				<Button color="primary" onClick={submit} disabled={!draft || save.isPending} isLoading={save.isPending} className="min-h-11">
					Guardar
				</Button>
			</div>
		</Section>
	);
};
