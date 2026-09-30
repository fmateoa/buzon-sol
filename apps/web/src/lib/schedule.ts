import type { ScheduleConfig, Weekday } from "@/domain/types";

const DAY_LABEL: Record<Weekday, string> = { mon: "L", tue: "M", wed: "X", thu: "J", fri: "V", sat: "S", sun: "D" };
export const WEEK: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const FREQUENCY_MINUTES = { "30m": 30, "1h": 60, "2h": 120, "4h": 240, daily: 1440 } as const;
const FREQUENCY_LABEL = { "30m": "Cada 30 min", "1h": "Cada 1 h", "2h": "Cada 2 h", "4h": "Cada 4 h", daily: "1 vez al día" } as const;

export const scheduleSummaryText = (config: Pick<ScheduleConfig, "state" | "frequency" | "days" | "pauseReason">) => {
	if (config.state === "disabled") return "Desactivado";
	if (config.state === "paused") return "En pausa";
	return `${FREQUENCY_LABEL[config.frequency]} · ${describeDays(config.days)}`;
};

export const describeDays = (days: Weekday[]) => {
	const sorted = WEEK.filter((d) => days.includes(d));
	const indexes = sorted.map((d) => WEEK.indexOf(d));
	const contiguous = indexes.every((value, i) => i === 0 || value === indexes[i - 1]! + 1);
	if (sorted.length === 7) return "L–D";
	if (contiguous && sorted.length > 2) return `${DAY_LABEL[sorted[0]!]}–${DAY_LABEL[sorted[sorted.length - 1]!]}`;
	return sorted.map((d) => DAY_LABEL[d]).join(", ");
};

/** Próximos disparos en hora de Lima dentro de la ventana y días configurados. */
export const computeNextRuns = (config: Pick<ScheduleConfig, "state" | "frequency" | "days" | "windowStart" | "windowEnd">, from: Date, count = 4): string[] => {
	if (config.state !== "active" || config.days.length === 0) return [];
	const step = FREQUENCY_MINUTES[config.frequency];
	const [sh, sm] = config.windowStart.split(":").map(Number) as [number, number];
	const [eh, em] = config.windowEnd.split(":").map(Number) as [number, number];
	const startMin = sh * 60 + sm;
	const endMin = eh * 60 + em;
	const result: string[] = [];
	// Trabajamos en «hora de Lima» desplazando UTC-5 (Perú no usa horario de verano).
	const lima = new Date(from.getTime() - 5 * 3_600_000);
	for (let dayOffset = 0; dayOffset < 8 && result.length < count; dayOffset++) {
		const day = new Date(Date.UTC(lima.getUTCFullYear(), lima.getUTCMonth(), lima.getUTCDate() + dayOffset));
		const weekday = WEEK[(day.getUTCDay() + 6) % 7]!;
		if (!config.days.includes(weekday)) continue;
		const slots = config.frequency === "daily" ? [startMin] : Array.from({ length: Math.floor((endMin - startMin) / step) + 1 }, (_, i) => startMin + i * step);
		for (const minute of slots) {
			const utc = new Date(day.getTime() + minute * 60_000 + 5 * 3_600_000);
			if (utc > from && result.length < count) result.push(utc.toISOString());
		}
	}
	return result;
};

