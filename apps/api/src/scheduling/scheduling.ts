import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { AppError, nextRuns, validateSchedule } from "@buzon-sol/domain";
import { DB } from "../common/tokens";
import { recordAudit } from "../common/audit";
import { AuthService, type Principal } from "../auth/auth";
import { validId } from "../common/ids";

type Input = { state?: unknown; boxes?: unknown; downloadReadAttachments?: unknown; notifyInApp?: unknown;
  notifyDailyEmail?: unknown; remoteEffectAccepted?: unknown };
const jsonValue = (value: unknown): unknown => typeof value === "string" ? JSON.parse(value) : value;

@Injectable()
export class SchedulingService {
  constructor(@Inject(DB) private readonly db: DataSource, @Inject(AuthService) private readonly auth: AuthService) {}

  async get(actor: Principal, accountId: string) {
    this.auth.requireAccount(actor, "configure_schedule", validId(accountId));
    const rows = await this.db.query("SELECT * FROM sync_schedules WHERE account_id=?", [accountId]);
    if (!rows.length) throw new AppError("not_found");
    const row = rows[0];
    const days = jsonValue(row.days_json);
    const boxes = jsonValue(row.boxes_json);
    const schedule = validateSchedule({ frequency: row.frequency, days,
      windowStart: String(row.window_start).slice(0, 5), windowEnd: String(row.window_end).slice(0, 5) });
    return { accountId, frequency: row.frequency, days,
      windowStart: String(row.window_start).slice(0, 5), windowEnd: String(row.window_end).slice(0, 5),
      boxes, state: row.state,
      downloadReadAttachments: Boolean(row.download_read_attachments),
      notifyInApp: Boolean(row.notify_in_app), notifyDailyEmail: Boolean(row.notify_daily_email),
      remoteEffectAccepted: Boolean(row.remote_effect_accepted), pauseReason: row.pause_reason,
      nextRuns: row.state === "active" ? nextRuns(schedule, new Date()).map((date) => date.toISOString()) : [],
    };
  }

  async save(actor: Principal, accountId: string, input: Input): Promise<void> {
    this.auth.requireAccount(actor, "configure_schedule", validId(accountId));
    const schedule = validateSchedule(input);
    if (input.state !== "disabled" && input.state !== "paused" && input.state !== "active") throw new AppError("validation");
    const active = input.state === "active";
    // Unattended runs need the inventory transport and the cron criterion of the SUNAT plan, both set by the operator.
    if (active && (process.env.SUNAT_CRON_VALIDATED !== "true" || process.env.SUNAT_TRANSPORT_VALIDATED !== "true")) {
      throw new AppError("remote_unavailable");
    }
    if (!Array.isArray(input.boxes) || input.boxes.length === 0 ||
        !input.boxes.every((box) => box === "messages" || box === "notifications") ||
        typeof input.downloadReadAttachments !== "boolean" ||
        typeof input.notifyInApp !== "boolean" ||
        input.notifyDailyEmail !== false ||
        typeof input.remoteEffectAccepted !== "boolean") throw new AppError("validation");
    await this.db.transaction(async (manager) => {
      const accounts: { active: number }[] = await manager.query("SELECT active FROM sunat_accounts WHERE id=?", [accountId]);
      if (!accounts.length) throw new AppError("not_found");
      if (!accounts[0].active) throw new AppError("paused");
      if (active) {
        const credentials: { status: string }[] = await manager.query(
          "SELECT status FROM sunat_credentials WHERE account_id=? ORDER BY version DESC LIMIT 1", [accountId]);
        if (!credentials.length) throw new AppError("needs_credential");
        if (credentials[0].status !== "valid") throw new AppError("invalid_credential");
      }
      const nextRunAt = active ? nextRuns(schedule, new Date(), 1)[0] ?? null : null;
      if (active && !nextRunAt) throw new AppError("validation");
      await manager.query(
        `INSERT INTO sync_schedules
         (id,account_id,frequency,days_json,window_start,window_end,boxes_json,state,
          download_read_attachments,notify_in_app,notify_daily_email,remote_effect_accepted,pause_reason,next_run_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE frequency=VALUES(frequency),days_json=VALUES(days_json),
           window_start=VALUES(window_start),window_end=VALUES(window_end),boxes_json=VALUES(boxes_json),
           state=VALUES(state),download_read_attachments=VALUES(download_read_attachments),
           notify_in_app=VALUES(notify_in_app),notify_daily_email=VALUES(notify_daily_email),
           remote_effect_accepted=VALUES(remote_effect_accepted),pause_reason=VALUES(pause_reason),
           next_run_at=VALUES(next_run_at)`,
        [randomUUID(), accountId, schedule.frequency, JSON.stringify(schedule.days), schedule.windowStart,
          schedule.windowEnd, JSON.stringify([...new Set(input.boxes as string[])]), input.state,
          input.downloadReadAttachments, input.notifyInApp, false, input.remoteEffectAccepted,
          input.state === "paused" ? "manual" : null, nextRunAt],
      );
      await recordAudit(manager, { actorId: actor.id, accountId, action: "update", objectType: "schedule", objectId: accountId });
    });
  }
}
