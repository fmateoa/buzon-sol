import { DataSource } from "typeorm";

/**
 * Exclusión por cuenta: un único trabajo con efecto sobre SUNAT por cuenta a la vez (inventario, lectura, archivo,
 * descargas, prueba de conexión y recuperación). Es un `GET_LOCK` de MySQL atado a una conexión dedicada: sobrevive
 * a las transacciones del trabajo y MySQL lo libera si el proceso muere.
 */
export class AccountLock {
  constructor(private readonly lease: Awaited<ReturnType<DataSource["createQueryRunner"]>>, private readonly name: string) {}

  async release(): Promise<void> {
    try { await this.lease.query("SELECT RELEASE_LOCK(?)", [this.name]); }
    finally { await this.lease.release(); }
  }
}

/** Devuelve la exclusión o `null` si otro trabajo ya la tiene; nunca espera. */
export async function tryAccountLock(db: DataSource, accountId: string): Promise<AccountLock | null> {
  const lease = db.createQueryRunner();
  const name = `buzon:${accountId}`;
  try {
    await lease.connect();
    const lock: { granted: number | string }[] = await lease.query("SELECT GET_LOCK(?,0) AS granted", [name]);
    if (Number(lock[0]?.granted) === 1) return new AccountLock(lease, name);
  } catch (error) {
    await lease.release();
    throw error;
  }
  await lease.release();
  return null;
}
