import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { AppError, SETTING_DEFINITIONS, SETTING_KEYS, type SettingKey } from "@buzon-sol/domain";
import type { Principal } from "./auth";
import { DB } from "./tokens";

const CACHE_MS = 15_000;

export type SettingDto = {
  key: SettingKey; group: string; unit: string; value: number; default: number; min: number; max: number;
  updatedAt: string | null;
};

type SettingRow = { setting_key: string; value_int: number; updated_at: Date };

/** Lee los ajustes con un caché corto: se consultan en cada petición autenticada. */
@Injectable()
export class SettingsService {
  private cache: { at: number; values: Map<SettingKey, number> } | null = null;

  constructor(@Inject(DB) private readonly db: DataSource) {}

  async get(key: SettingKey): Promise<number> {
    if (!this.cache || Date.now() - this.cache.at > CACHE_MS) {
      const rows: SettingRow[] = await this.db.query("SELECT setting_key,value_int FROM app_settings");
      const values = new Map<SettingKey, number>();
      for (const row of rows) {
        const def = SETTING_DEFINITIONS[row.setting_key as SettingKey];
        if (def && row.value_int >= def.min && row.value_int <= def.max) values.set(row.setting_key as SettingKey, row.value_int);
      }
      this.cache = { at: Date.now(), values };
    }
    return this.cache.values.get(key) ?? SETTING_DEFINITIONS[key].default;
  }

  async list(actor: Principal): Promise<SettingDto[]> {
    this.requireManage(actor);
    const rows: SettingRow[] = await this.db.query("SELECT setting_key,value_int,updated_at FROM app_settings");
    return SETTING_KEYS.map((key) => {
      const def = SETTING_DEFINITIONS[key];
      const row = rows.find((r) => r.setting_key === key);
      return { key, group: def.group, unit: def.unit, value: row?.value_int ?? def.default, default: def.default,
        min: def.min, max: def.max, updatedAt: row ? new Date(row.updated_at).toISOString() : null };
    });
  }

  async save(actor: Principal, body: unknown): Promise<void> {
    this.requireManage(actor);
    const input = (body as { values?: unknown } | null)?.values;
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new AppError("validation");
    const entries = Object.entries(input as Record<string, unknown>);
    if (!entries.length) throw new AppError("validation");
    const next = new Map<SettingKey, number>();
    for (const [key, value] of entries) {
      if (!SETTING_KEYS.includes(key as SettingKey)) throw new AppError("validation");
      const def = SETTING_DEFINITIONS[key as SettingKey];
      if (!Number.isInteger(value) || (value as number) < def.min || (value as number) > def.max) throw new AppError("validation");
      next.set(key as SettingKey, value as number);
    }
    await this.db.transaction(async (manager) => {
      const rows: SettingRow[] = await manager.query("SELECT setting_key,value_int FROM app_settings FOR UPDATE");
      const current = new Map(rows.map((r) => [r.setting_key, r.value_int]));
      const effective = (key: SettingKey) => next.get(key) ?? current.get(key) ?? SETTING_DEFINITIONS[key].default;
      // La inactividad nunca puede superar la duración absoluta: sería un límite que no se alcanza.
      if (effective("session.idleMinutes") > effective("session.absoluteMinutes")) throw new AppError("validation");
      const changes: Record<string, { from: number; to: number }> = {};
      for (const [key, value] of next) {
        const from = current.get(key) ?? SETTING_DEFINITIONS[key].default;
        if (from === value) continue;
        changes[key] = { from, to: value };
        if (value === SETTING_DEFINITIONS[key].default) await manager.query("DELETE FROM app_settings WHERE setting_key=?", [key]);
        else await manager.query(
          `INSERT INTO app_settings (setting_key,value_int,updated_by) VALUES (?,?,?)
           ON DUPLICATE KEY UPDATE value_int=VALUES(value_int),updated_by=VALUES(updated_by),updated_at=CURRENT_TIMESTAMP(6)`,
          [key, value, actor.id]);
      }
      if (Object.keys(changes).length) {
        await manager.query(
          "INSERT INTO audit_events (id,actor_user_id,action,object_type,object_id,change_json) VALUES (?,?,?,?,?,?)",
          [randomUUID(), actor.id, "update", "settings", "settings", JSON.stringify(changes)]);
      }
    });
    this.cache = null;
  }

  private requireManage(actor: Principal): void {
    if (!actor.permissions.includes("manage_settings")) throw new AppError("forbidden");
  }
}
