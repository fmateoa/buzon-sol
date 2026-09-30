import type { CommandResult } from "@/domain/adapter";
import { errorCopy } from "./errors";

export interface BatchOutcome {
	succeeded: string[];
	failed: { name: string; reason: string }[];
}

/**
 * Una petición por registro con `Promise.allSettled`: un fallo no revierte ni detiene
 * los demás y se devuelve un único resultado con éxitos y fallos.
 */
export const runBatch = async <T>(items: { id: string; name: string }[], command: (id: string) => Promise<CommandResult<T>>): Promise<BatchOutcome> => {
	const results = await Promise.allSettled(items.map((item) => command(item.id)));
	const outcome: BatchOutcome = { succeeded: [], failed: [] };
	results.forEach((result, i) => {
		const name = items[i]!.name;
		if (result.status === "fulfilled" && result.value.ok) outcome.succeeded.push(name);
		else if (result.status === "fulfilled" && !result.value.ok) outcome.failed.push({ name, reason: result.value.error.fields ? Object.values(result.value.error.fields).join(" ") : errorCopy(result.value.error).title });
		else outcome.failed.push({ name, reason: errorCopy(result.status === "rejected" ? result.reason : null).title });
	});
	return outcome;
};
