import { MigrationInterface, QueryRunner } from "typeorm";

export class ScheduleOptions2026093000003 implements MigrationInterface {
  name = "ScheduleOptions2026093000003";
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE sync_schedules
      ADD COLUMN download_read_attachments boolean NOT NULL DEFAULT false,
      ADD COLUMN notify_in_app boolean NOT NULL DEFAULT true,
      ADD COLUMN notify_daily_email boolean NOT NULL DEFAULT false,
      ADD COLUMN pause_reason varchar(40) NULL`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE sync_schedules
      DROP COLUMN pause_reason, DROP COLUMN notify_daily_email,
      DROP COLUMN notify_in_app, DROP COLUMN download_read_attachments`);
  }
}
