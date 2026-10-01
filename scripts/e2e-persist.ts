/**
 * E2E local: credenciales por stdin -> cuenta cifrada en MySQL -> worker descifra -> sesión SUNAT real -> inventario persistido.
 * Solo contra MySQL local (compose.test.yml). Emite únicamente conteos; nunca RUC, usuarios, asuntos ni identificadores.
 * Con `--e2e-archive` hace una sola pasada de inventario y luego un lote de archivo por cuenta: abre únicamente
 * elementos que SUNAT ya lista como leídos (`E2E_ARCHIVE_ITEMS`, 5 por defecto) y, con `E2E_ARCHIVE_FILES=1`, guarda
 * sus archivos en el S3 local de pruebas.
 */
import { createHmac, generateKeyPairSync, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { encryptForWorker } from "../packages/domain/src/index.js";
import { SunatHttpSession } from "../packages/sunat-adapter/src/index.js";
import { ArchiveProcessor } from "../apps/worker/src/archive.js";
import { loadSolCredential } from "../apps/worker/src/credentials.js";
import { InventoryRunner } from "../apps/worker/src/inventory.js";
import { testDb } from "../apps/worker/test/db.js";

type Credential = { ruc: string; solUser: string; password: string };
const KEY_ID = "dev-local-1";

/** Clave de desarrollo local persistente: sin ella las credenciales guardadas en MySQL no se podrían descifrar luego. */
function devKeys(): { publicPem: string; privatePem: string; fingerprintKeyB64: string } {
  const directory = join(process.env.LOCALAPPDATA ?? ".", "BuzonSol");
  const file = join(directory, "dev-worker-keys.json");
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  const pair = generateKeyPairSync("rsa", { modulusLength: 3072 });
  const keys = {
    publicPem: pair.publicKey.export({ type: "spki", format: "pem" }).toString(),
    privatePem: pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    fingerprintKeyB64: Buffer.from(Array.from({ length: 32 }, () => Math.floor(Math.random() * 256))).toString("base64"),
  };
  mkdirSync(directory, { recursive: true });
  writeFileSync(file, JSON.stringify(keys), { mode: 0o600 });
  return keys;
}

/** Un lote de archivo real por cuenta. Solo conteos; `unexpectedReads` debe ser 0 (ningún elemento cambió a leído). */
async function archiveBatch(db: Awaited<ReturnType<typeof testDb>>, accountId: string): Promise<object> {
  const files = process.env.E2E_ARCHIVE_FILES === "1";
  const limit = Math.min(Math.max(Math.trunc(Number(process.env.E2E_ARCHIVE_ITEMS ?? 5)) || 5, 1), 50);
  // Proceso local de sonda: las puertas valen solo dentro de esta ejecución, igual que el resto del E2E.
  process.env.SUNAT_READ_VALIDATED = "true";
  if (files) {
    process.env.SUNAT_FILE_CLIENT_READY = "true";
    process.env.S3_ENDPOINT ??= "http://127.0.0.1:39090";
    process.env.S3_BUCKET ??= "buzon-test";
    process.env.S3_ACCESS_KEY ??= "test";
    process.env.S3_SECRET_KEY ??= "test";
  }
  const unread = async () => {
    const rows: { n: string }[] = await db.query("SELECT COUNT(*) AS n FROM mail_items WHERE account_id=? AND ind_estado=0", [accountId]);
    return Number(rows[0]!.n);
  };
  const unreadBefore = await unread();
  await db.query("UPDATE sunat_accounts SET archive_content=true,archive_files=?,archive_batch_size=? WHERE id=?", [files, limit, accountId]);
  const runId = randomUUID();
  await db.query("INSERT INTO archive_runs (id,account_id,trigger_kind,state) VALUES (?,?,'manual','pending')", [runId, accountId]);
  const started = Date.now();
  let error: string | null = null;
  try {
    await new ArchiveProcessor(db, async (id) => SunatHttpSession.open(await loadSolCredential(db, id))).process(accountId, runId);
  } catch (caught) { error = caught instanceof Error && "code" in caught ? String(caught.code) : "archive_failed"; }
  const run: { state: string; error_code: string | null; items_done: number; items_failed: number; files_stored: number;
    files_failed: number; remaining: number | null }[] = await db.query(
    "SELECT state,error_code,items_done,items_failed,files_stored,files_failed,remaining FROM archive_runs WHERE id=?", [runId]);
  const flagged: { n: string }[] = await db.query(
    "SELECT COUNT(*) AS n FROM mail_read_events WHERE account_id=? AND origin='archive' AND update_leido=true", [accountId]);
  return { state: run[0]?.state, error: run[0]?.error_code ?? error, itemsStored: run[0]?.items_done, itemsFailed: run[0]?.items_failed,
    filesStored: run[0]?.files_stored, filesFailed: run[0]?.files_failed, remaining: run[0]?.remaining,
    unexpectedReads: Number(flagged[0]!.n), unreadInDbBefore: unreadBefore, unreadInDbAfter: await unread(),
    seconds: Math.round((Date.now() - started) / 1000) };
}

async function main(): Promise<void> {
  const host = process.env.DB_HOST ?? "127.0.0.1";
  if (!["127.0.0.1", "localhost"].includes(host)) throw new Error("local_database_only");
  process.env.DB_HOST = host;
  process.env.DB_PORT ??= "33361";
  process.env.DB_USER ??= "buzon";
  process.env.DB_PASSWORD ??= "localtest";
  process.env.DB_NAME ??= "buzon_sol";
  const keys = devKeys();
  process.env.SOL_PRIVATE_KEY_PEM = keys.privatePem;

  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  const { accounts } = JSON.parse(input) as { accounts: Credential[] };
  if (!Array.isArray(accounts) || accounts.length < 1) throw new Error("credential_shape");

  const db = await testDb();
  try {
    // 1) Cuentas: mismo cifrado y huella que AccountsService (RUC/usuario/clave solo cifrados).
    const ids: string[] = [];
    for (const [index, account] of accounts.entries()) {
      if (!/^\d{11}$/.test(account.ruc) || !account.solUser || !account.password) throw new Error("credential_shape");
      const fingerprint = createHmac("sha256", Buffer.from(keys.fingerprintKeyB64, "base64")).update(account.ruc).digest();
      const existing: { id: string }[] = await db.query("SELECT id FROM sunat_accounts WHERE ruc_fingerprint=?", [fingerprint]);
      let id = existing[0]?.id;
      if (!id) {
        id = randomUUID();
        await db.query(
          `INSERT INTO sunat_accounts (id,alias,ruc_ciphertext,sol_user_ciphertext,ruc_fingerprint,ruc_masked,sol_user_masked)
           VALUES (?,?,?,?,?,?,?)`,
          [id, `Cuenta local ${index + 1}`, encryptForWorker(account.ruc, keys.publicPem, KEY_ID),
            encryptForWorker(account.solUser, keys.publicPem, KEY_ID), fingerprint,
            `*******${account.ruc.slice(-4)}`, `${account.solUser.slice(0, 2)}***`]);
      }
      const encrypted = encryptForWorker(account.password, keys.publicPem, KEY_ID);
      const nonce = Buffer.from((JSON.parse(encrypted.toString("utf8")) as { nonce: string }).nonce, "base64");
      const version: { v: number }[] = await db.query("SELECT COALESCE(MAX(version),0)+1 AS v FROM sunat_credentials WHERE account_id=?", [id]);
      await db.query("INSERT INTO sunat_credentials (id,account_id,version,ciphertext,nonce,key_id,status) VALUES (?,?,?,?,?,?,?)",
        [randomUUID(), id, Number(version[0]!.v), encrypted, nonce, KEY_ID, "untested"]);
      ids.push(id);
    }

    // 2) Inventario de todas las cuentas a la vez, dos pasadas (la segunda no debe duplicar).
    const counts = async (accountId: string) => {
      const rows: { tipo_msj: number; total: string; unread: string; distinctCodes: string }[] = await db.query(
        `SELECT tipo_msj,COUNT(*) AS total,SUM(ind_estado=0) AS unread,COUNT(DISTINCT cod_mensaje) AS distinctCodes
         FROM mail_items WHERE account_id=? GROUP BY tipo_msj ORDER BY tipo_msj`, [accountId]);
      return rows.map((row) => ({ box: row.tipo_msj === 1 ? "messages" : "notifications",
        rows: Number(row.total), unread: Number(row.unread), distinct: Number(row.distinctCodes) }));
    };
    const pass = async (accountId: string) => {
      const started = Date.now();
      const credential = await loadSolCredential(db, accountId); // descifrado como en el worker
      const session = await SunatHttpSession.open(credential);
      try {
        const runner = new InventoryRunner(db, session);
        const runId = await runner.createRun(accountId, "manual");
        await runner.run(accountId, runId);
        const run: { state: string; error_code: string | null }[] = await db.query("SELECT state,error_code FROM sync_runs WHERE id=?", [runId]);
        const pages: { n: string; empties: string }[] = await db.query(
          "SELECT COUNT(*) AS n,SUM(confirmed_empty) AS empties FROM sync_pages WHERE run_id=?", [runId]);
        return { state: run[0]?.state, error: run[0]?.error_code, pages: Number(pages[0]?.n), emptyConfirmations: Number(pages[0]?.empties),
          seconds: Math.round((Date.now() - started) / 1000), persisted: await counts(accountId) };
      } finally { await session.close(); }
    };
    const archiveMode = process.argv[2] === "--e2e-archive";
    const first = await Promise.all(ids.map(pass));
    const second = archiveMode ? first : await Promise.all(ids.map(pass));
    const report = ids.map((_, index) => ({
      account: index + 1, first: first[index], secondPassSameCounts: JSON.stringify(first[index]!.persisted) === JSON.stringify(second[index]!.persisted),
      secondState: second[index]!.state,
    }));
    const crossAccount: { n: string }[] = await db.query(
      `SELECT COUNT(*) AS n FROM mail_items m WHERE m.account_id IN (${ids.map(() => "?").join(",")})
       AND NOT EXISTS (SELECT 1 FROM sunat_accounts a WHERE a.id=m.account_id)`, ids);
    const archive = archiveMode ? await Promise.all(ids.map((accountId) => archiveBatch(db, accountId))) : undefined;
    process.stdout.write(JSON.stringify({ accountsRun: ids.length, report, orphanRows: Number(crossAccount[0]!.n), archive }) + "\n");
  } finally { await db.destroy(); }
}

main().catch((error) => {
  process.stderr.write(JSON.stringify({ error: error instanceof Error && "code" in error ? error.code : error instanceof Error ? error.message.slice(0, 120) : "e2e_failed" }) + "\n");
  process.exitCode = 1;
});
