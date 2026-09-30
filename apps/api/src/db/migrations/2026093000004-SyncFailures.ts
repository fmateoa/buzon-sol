import { MigrationInterface, QueryRunner } from "typeorm";

export class SyncFailures2026093000004 implements MigrationInterface {
  name = "SyncFailures2026093000004";
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE sunat_accounts ADD COLUMN sync_failure_streak int NOT NULL DEFAULT 0");
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE sunat_accounts DROP COLUMN sync_failure_streak");
  }
}
