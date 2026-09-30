import { DataSource } from "typeorm";
import { AppError } from "@buzon-sol/domain";
import { openEnvelope, privateKeyFor } from "./keyring.js";

export interface SolCredential {
  ruc: string;
  solUser: string;
  password: string;
  keyId: string;
}

/** Call only inside a worker job and discard the returned strings after the session closes. */
export async function loadSolCredential(db: DataSource, accountId: string): Promise<SolCredential> {
  privateKeyFor(""); // Fails before touching the database when no worker key is configured.
  const rows: { active: number; ruc_ciphertext: Buffer; sol_user_ciphertext: Buffer;
    ciphertext: Buffer | null; key_id: string | null; status: string | null }[] = await db.query(
    `SELECT a.active,a.ruc_ciphertext,a.sol_user_ciphertext,c.ciphertext,c.key_id,c.status
     FROM sunat_accounts a LEFT JOIN sunat_credentials c ON c.id=(
       SELECT id FROM sunat_credentials WHERE account_id=a.id ORDER BY version DESC LIMIT 1)
     WHERE a.id=?`, [accountId]);
  const row = rows[0];
  if (!row) throw new AppError("not_found");
  if (!row.active) throw new AppError("paused");
  if (!row.ciphertext) throw new AppError("needs_credential");
  if (row.status === "rejected") throw new AppError("invalid_credential");
  return { ruc: openEnvelope(row.ruc_ciphertext), solUser: openEnvelope(row.sol_user_ciphertext),
    password: openEnvelope(row.ciphertext), keyId: row.key_id ?? "" };
}
