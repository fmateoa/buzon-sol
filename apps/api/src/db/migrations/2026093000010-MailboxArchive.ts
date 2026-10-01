import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Per-account mailbox archive: stored content and files of items SUNAT already shows as read.
 * The switches default to off; system reads are told apart from user reads by `origin`.
 */
export class MailboxArchive2026093000010 implements MigrationInterface {
  name = "MailboxArchive2026093000010";
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE sunat_accounts
      ADD COLUMN archive_content boolean NOT NULL DEFAULT false,
      ADD COLUMN archive_files boolean NOT NULL DEFAULT false,
      ADD COLUMN archive_batch_size int NOT NULL DEFAULT 200`);
    await queryRunner.query(`CREATE TABLE archive_runs (
      id varchar(36) PRIMARY KEY,
      account_id varchar(36) NOT NULL,
      trigger_kind varchar(16) NOT NULL,
      sync_run_id varchar(36) NULL,
      actor_user_id varchar(36) NULL,
      state varchar(16) NOT NULL,
      error_code varchar(40) NULL,
      items_done int NOT NULL DEFAULT 0,
      items_failed int NOT NULL DEFAULT 0,
      files_stored int NOT NULL DEFAULT 0,
      files_failed int NOT NULL DEFAULT 0,
      remaining int NULL,
      created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      started_at datetime(6) NULL,
      finished_at datetime(6) NULL,
      KEY ix_archive_account_created (account_id, created_at),
      CONSTRAINT fk_archive_account FOREIGN KEY (account_id) REFERENCES sunat_accounts(id),
      CONSTRAINT fk_archive_actor FOREIGN KEY (actor_user_id) REFERENCES app_users(id)
    ) ENGINE=InnoDB`);
    await queryRunner.query(`ALTER TABLE mail_read_events
      ADD COLUMN origin varchar(16) NOT NULL DEFAULT 'user',
      ADD KEY ix_read_account_origin (account_id, origin, status)`);
    await queryRunner.query("ALTER TABLE mail_details ADD COLUMN ind_texto varchar(8) NULL");
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE mail_details DROP COLUMN ind_texto");
    await queryRunner.query("ALTER TABLE mail_read_events DROP KEY ix_read_account_origin, DROP COLUMN origin");
    await queryRunner.query("DROP TABLE archive_runs");
    await queryRunner.query(`ALTER TABLE sunat_accounts
      DROP COLUMN archive_batch_size, DROP COLUMN archive_files, DROP COLUMN archive_content`);
  }
}
