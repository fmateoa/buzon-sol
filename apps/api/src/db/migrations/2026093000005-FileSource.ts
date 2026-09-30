import { MigrationInterface, QueryRunner } from "typeorm";

export class FileSource2026093000005 implements MigrationInterface {
  name = "FileSource2026093000005";
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE file_assets ADD COLUMN num_id varchar(100) NULL");
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE file_assets DROP COLUMN num_id");
  }
}
