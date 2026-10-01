import { MigrationInterface, QueryRunner } from "typeorm";

/** Normalized row metadata for persisted mailbox queries. The original row stays in row_json. */
export class MailListing2026093000008 implements MigrationInterface {
  name = "MailListing2026093000008";
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE mail_items
      ADD COLUMN published_at datetime(6) NULL,
      ADD COLUMN sender_text varchar(160) NULL,
      ADD COLUMN folder_code varchar(40) NULL,
      ADD COLUMN label_code varchar(40) NULL,
      ADD COLUMN attachment_count int NULL,
      ADD KEY ix_mail_box_published (account_id, tipo_msj, published_at)`);
    // America/Lima has used UTC-05:00 without daylight saving since 1994; the worker recomputes on the next upsert.
    await queryRunner.query(`UPDATE mail_items SET
      published_at = CASE WHEN published_at_text REGEXP '^[0-9]{2}/[0-9]{2}/[0-9]{4} [0-9]{2}:[0-9]{2}:[0-9]{2}$'
        THEN STR_TO_DATE(published_at_text, '%d/%m/%Y %H:%i:%s') + INTERVAL 5 HOUR END,
      sender_text = LEFT(JSON_UNQUOTE(NULLIF(JSON_EXTRACT(row_json, '$.codUsremisor'), CAST('null' AS JSON))), 160),
      folder_code = LEFT(JSON_UNQUOTE(NULLIF(JSON_EXTRACT(row_json, '$.codCarpeta'), CAST('null' AS JSON))), 40),
      label_code = LEFT(JSON_UNQUOTE(NULLIF(JSON_EXTRACT(row_json, '$.codEtiqueta'), CAST('null' AS JSON))), 40),
      attachment_count = CASE WHEN JSON_TYPE(JSON_EXTRACT(row_json, '$.cantidadArchAdj')) = 'INTEGER'
        THEN JSON_EXTRACT(row_json, '$.cantidadArchAdj') END`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE mail_items DROP KEY ix_mail_box_published,
      DROP COLUMN attachment_count, DROP COLUMN label_code, DROP COLUMN folder_code,
      DROP COLUMN sender_text, DROP COLUMN published_at`);
  }
}
