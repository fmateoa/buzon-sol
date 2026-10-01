import { createHash } from "node:crypto";
import { DataSource } from "typeorm";
import { AppError } from "@buzon-sol/domain";
import sanitizeHtml from "sanitize-html";
import { tryAccountLock } from "./account-lock.js";

export interface FileResponse { status: number; contentType: string; bytes: Buffer; verifiedGeneratedDocument?: boolean }
export interface FileClient {
  fetch(accountId: string, itemId: string, kind: "attachment" | "generated_document",
    codArchivo: string | null, numId: string | null): Promise<FileResponse>;
  close?(): Promise<void>;
}
export interface ObjectStore {
  put(key: string, bytes: Buffer, mime: string): Promise<void>;
}

const magic: Record<string, (bytes: Buffer) => boolean> = {
  "application/pdf": (bytes) => bytes.subarray(0, 5).toString() === "%PDF-",
  "image/png": (bytes) => bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  "image/jpeg": (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  "application/zip": (bytes) => bytes.subarray(0, 4).equals(Buffer.from([80, 75, 3, 4])),
};

export function validateFile(response: FileResponse, kind: "attachment" | "generated_document" = "attachment",
  maxBytes = 20 * 1024 * 1024): { bytes: Buffer; mime: string; sha256: string } {
  const mime = response.contentType.split(";")[0].trim().toLowerCase();
  if (kind === "generated_document" && mime === "text/html" && response.status === 200 &&
      response.verifiedGeneratedDocument && response.bytes.length > 0 && response.bytes.length <= maxBytes) {
    const safe = sanitizeHtml(response.bytes.toString("utf8"), {
      allowedTags: ["html", "head", "body", "title", "p", "br", "b", "strong", "i", "em", "u",
        "ul", "ol", "li", "table", "thead", "tbody", "tr", "td", "th", "div", "span"],
      allowedAttributes: {},
    });
    const bytes = Buffer.from(safe);
    return { bytes, mime, sha256: createHash("sha256").update(bytes).digest("hex") };
  }
  if (response.status !== 200 || !Object.hasOwn(magic, mime) || response.bytes.length === 0 ||
      response.bytes.length > maxBytes || !magic[mime](response.bytes)) throw new AppError("schema_changed");
  return { bytes: response.bytes, mime, sha256: createHash("sha256").update(response.bytes).digest("hex") };
}

export interface StorableAsset { id: string; item_id: string; kind: "attachment" | "generated_document" }

/**
 * Validates and stores one fetched file. Nothing is written unless the bytes match an allowed type; any failure
 * leaves the asset `failed`. The caller holds the account lock.
 */
export async function storeFile(db: DataSource, store: ObjectStore, accountId: string, asset: StorableAsset,
  fetch: () => Promise<FileResponse>): Promise<void> {
  const objectKey = `${accountId}/${asset.item_id}/${asset.id}`;
  try {
    const response = await fetch();
    const validated = validateFile(response, asset.kind);
    try {
      if (asset.kind === "generated_document") {
        // Keep SUNAT's original in the private bucket; the API serves only the sanitized copy.
        await store.put(`${objectKey}.original`, response.bytes, "text/html");
      }
      await store.put(objectKey, validated.bytes, validated.mime);
    } catch { throw new AppError("storage_unavailable"); }
    await db.query(
      "UPDATE file_assets SET object_key=?,mime_type=?,size_bytes=?,sha256=?,state='stored' WHERE id=? AND account_id=?",
      [objectKey, validated.mime, validated.bytes.length, validated.sha256, asset.id, accountId],
    );
  } catch (error) {
    await db.query("UPDATE file_assets SET state='failed' WHERE id=? AND account_id=? AND state<>'stored'", [asset.id, accountId]);
    throw error;
  }
}

export class FileProcessor {
  constructor(private readonly db: DataSource, private readonly client: FileClient, private readonly store: ObjectStore) {}

  async process(accountId: string, fileId: string, authorize?: () => Promise<void>): Promise<void> {
    const lock = await tryAccountLock(this.db, accountId);
    if (!lock) throw new AppError("conflict_running");
    try {
      const assets: { id: string; item_id: string; kind: "attachment" | "generated_document";
        cod_archivo: string | null; num_id: string | null; state: string }[] =
        await this.db.query("SELECT id,item_id,kind,cod_archivo,num_id,state FROM file_assets WHERE id=? AND account_id=?", [fileId, accountId]);
      const asset = assets[0];
      if (!asset) throw new AppError("not_found");
      if (asset.state === "stored") return;
      await authorize?.();
      const response = async () => this.client.fetch(accountId, asset.item_id, asset.kind, asset.cod_archivo, asset.num_id);
      await storeFile(this.db, this.store, accountId, asset, response);
    } finally {
      await lock.release();
    }
  }
}
