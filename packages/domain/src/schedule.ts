import { AppError } from "./index.js";

export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];
export type Frequency = "30m" | "1h" | "2h" | "4h" | "daily";
export interface ScheduleInput {
  frequency: Frequency;
  days: Weekday[];
  windowStart: string;
  windowEnd: string;
}

const steps: Record<Frequency, number> = { "30m": 30, "1h": 60, "2h": 120, "4h": 240, daily: 1440 };
const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

function localParts(date: Date): { year: number; month: number; day: number; hour: number; minute: number } {
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, Number(part.value)]));
  return { year: parts.year, month: parts.month, day: parts.day, hour: parts.hour, minute: parts.minute };
}

function limaInstant(year: number, month: number, day: number, minuteOfDay: number): Date {
  const approximate = Date.UTC(year, month - 1, day, Math.floor(minuteOfDay / 60), minuteOfDay % 60);
  const local = localParts(new Date(approximate));
  const offset = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute) - approximate;
  return new Date(approximate - offset);
}

export function validateSchedule(input: unknown): ScheduleInput {
  if (!input || typeof input !== "object") throw new AppError("validation");
  const value = input as Record<string, unknown>;
  if (typeof value.frequency !== "string" || !Object.hasOwn(steps, value.frequency) ||
      !Array.isArray(value.days) || value.days.length === 0 ||
      !value.days.every((day) => WEEKDAYS.includes(day)) ||
      typeof value.windowStart !== "string" || typeof value.windowEnd !== "string" ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.windowStart) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.windowEnd) ||
      value.windowStart > value.windowEnd) throw new AppError("validation");
  return { frequency: value.frequency as Frequency, days: [...new Set(value.days)] as Weekday[],
    windowStart: value.windowStart, windowEnd: value.windowEnd };
}

/** UTC instants for slots defined on the America/Lima calendar. */
export function nextRuns(input: ScheduleInput, from: Date, count = 4): Date[] {
  const schedule = validateSchedule(input);
  const local = localParts(from);
  const startDay = Date.UTC(local.year, local.month - 1, local.day);
  const startMinute = Number(schedule.windowStart.slice(0, 2)) * 60 + Number(schedule.windowStart.slice(3));
  const endMinute = Number(schedule.windowEnd.slice(0, 2)) * 60 + Number(schedule.windowEnd.slice(3));
  const result: Date[] = [];
  for (let offset = 0; offset < 35 && result.length < count; offset++) {
    const day = new Date(startDay + offset * 86400_000);
    const weekday = WEEKDAYS[(day.getUTCDay() + 6) % 7];
    if (!schedule.days.includes(weekday)) continue;
    for (let minute = startMinute; minute <= endMinute && result.length < count; minute += steps[schedule.frequency]) {
      const instant = limaInstant(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), minute);
      if (instant > from) result.push(instant);
    }
  }
  return result;
}
