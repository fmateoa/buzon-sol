import { AppError, type MailBox } from "@buzon-sol/domain";
import { SunatHttpSession } from "@buzon-sol/sunat-adapter";
import { DataSource } from "typeorm";
import { type FileClient, type FileResponse } from "./files.js";

/** Reopens the authorized item immediately before fetching a file in one session. */
export class SunatFileClient implements FileClient {
  constructor(private readonly db: DataSource, private readonly session: SunatHttpSession) {}

  async fetch(accountId: string, itemId: string, kind: "attachment" | "generated_document",
    codArchivo: string | null, numId: string | null): Promise<FileResponse> {
    const rows: { tipo_msj: number; cod_mensaje: string }[] = await this.db.query(
      "SELECT tipo_msj,cod_mensaje FROM mail_items WHERE id=? AND account_id=?", [itemId, accountId]);
    if (!rows.length || ![1, 2].includes(Number(rows[0].tipo_msj)) || !/^\d+$/.test(rows[0].cod_mensaje)) {
      throw new AppError("schema_changed");
    }
    const box: MailBox = Number(rows[0].tipo_msj) === 1 ? "messages" : "notifications";
    if (kind === "attachment") {
      if (!codArchivo) throw new AppError("schema_changed");
      return this.session.fetchAttachment(box, rows[0].cod_mensaje, codArchivo);
    }
    if (!numId) throw new AppError("schema_changed");
    return this.session.fetchGeneratedDocument(box, rows[0].cod_mensaje, numId);
  }

  async close(): Promise<void> { await this.session.close(); }
}
