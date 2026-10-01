import { randomUUID } from "node:crypto";

/** Lo que necesita escribir un evento: `EntityManager` (dentro de una transacción) o `DataSource`. */
export interface Queryable {
  query(sql: string, parameters?: unknown[]): Promise<unknown>;
}

export interface AuditEvent {
  actorId: string;
  action: string;
  objectType: string;
  objectId: string;
  accountId?: string;
  /** Solo datos no sensibles (nunca secretos, asuntos ni cuerpos). */
  change?: Record<string, unknown>;
}

/**
 * Único punto que escribe `audit_events` desde la API. Quien lo llama decide la transacción: pasar el
 * `EntityManager` de la que cambia el estado para que acción y evento se confirmen juntos.
 */
export async function recordAudit(db: Queryable, event: AuditEvent): Promise<void> {
  const columns = ["id", "actor_user_id"];
  const values: unknown[] = [randomUUID(), event.actorId];
  if (event.accountId !== undefined) { columns.push("account_id"); values.push(event.accountId); }
  columns.push("action", "object_type", "object_id");
  values.push(event.action, event.objectType, event.objectId);
  if (event.change !== undefined) { columns.push("change_json"); values.push(JSON.stringify(event.change)); }
  await db.query(`INSERT INTO audit_events (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`, values);
}
