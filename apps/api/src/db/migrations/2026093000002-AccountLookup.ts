import { MigrationInterface, QueryRunner } from "typeorm";

export class AccountLookup2026093000002 implements MigrationInterface {
  name = "AccountLookup2026093000002";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE sunat_accounts
      ADD COLUMN ruc_fingerprint binary(32) NULL,
      ADD COLUMN ruc_masked varchar(20) NULL,
      ADD COLUMN sol_user_masked varchar(40) NULL,
      ADD UNIQUE KEY uq_account_ruc_fingerprint (ruc_fingerprint)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE sunat_accounts
      DROP INDEX uq_account_ruc_fingerprint,
      DROP COLUMN sol_user_masked,
      DROP COLUMN ruc_masked,
      DROP COLUMN ruc_fingerprint`);
  }
}
