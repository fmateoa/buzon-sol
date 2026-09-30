import { DataSource } from "typeorm";
import { AppError, decryptInWorker } from "@buzon-sol/domain";

export interface SolCredential {
  ruc: string;
  solUser: string;
  password: string;
  keyId: string;
}

/** Call only inside a worker job and discard the returned strings after the session closes. */
export async function loadSolCredential(db: DataSource, accountId: string): Promise<SolCredential> {
  const privateKey = process.env.SOL_PRIVATE_KEY_PEM?.replace(/\\n/g, "\n");
  if (!privateKey) throw new Error("Worker private key is not configured");
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
  return { ruc: decryptInWorker(row.ruc_ciphertext, privateKey),
    solUser: decryptInWorker(row.sol_user_ciphertext, privateKey),
    password: decryptInWorker(row.ciphertext, privateKey), keyId: row.key_id ?? "" };
}
