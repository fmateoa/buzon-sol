import { AppError } from "@buzon-sol/domain";

const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isId = (value: unknown): value is string => typeof value === "string" && idPattern.test(value);

export function validId(value: unknown): string {
  if (!isId(value)) throw new AppError("validation");
  return value;
}
