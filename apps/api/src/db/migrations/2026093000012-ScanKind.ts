import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Incremental inventory: a run is `full` (walks every page) or `incremental` (stops at the first page whose rows
 * are all already stored and unchanged). `yield_count` counts how often a run released the account to a user
 * command and resumed. Existing runs keep `full`, which is what they were.
 */
export class ScanKind2026093000012 implements MigrationInterface {
  name = "ScanKind2026093000012";
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE sync_runs
      ADD COLUMN scan_kind varchar(12) NOT NULL DEFAULT 'full',
      ADD COLUMN yield_count int NOT NULL DEFAULT 0,
      ADD KEY ix_sync_account_kind (account_id, scan_kind, state, finished_at)`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE sync_runs DROP KEY ix_sync_account_kind, DROP COLUMN yield_count, DROP COLUMN scan_kind");
  }
}
