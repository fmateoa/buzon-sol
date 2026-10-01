import { MigrationInterface, QueryRunner } from "typeorm";

/** SUNAT catalogs, per-run scope and results, notice counts and system-initiated file fetches. */
export class CatalogsAndNotices2026093000009 implements MigrationInterface {
  name = "CatalogsAndNotices2026093000009";
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE sunat_folders (
      account_id varchar(36) NOT NULL, code varchar(40) NOT NULL,
      name varchar(200) NOT NULL, message_count int NULL,
      observed_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      PRIMARY KEY (account_id, code),
      CONSTRAINT fk_folders_account FOREIGN KEY (account_id) REFERENCES sunat_accounts(id)
    ) ENGINE=InnoDB`);
    await queryRunner.query(`CREATE TABLE sunat_labels (
      account_id varchar(36) NOT NULL, code varchar(40) NOT NULL,
      name varchar(200) NOT NULL, color varchar(20) NULL, message_count int NULL,
      observed_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      PRIMARY KEY (account_id, code),
      CONSTRAINT fk_labels_account FOREIGN KEY (account_id) REFERENCES sunat_accounts(id)
    ) ENGINE=InnoDB`);
    await queryRunner.query(`ALTER TABLE sync_runs
      ADD COLUMN boxes_json json NULL,
      ADD COLUMN folders_state varchar(16) NULL,
      ADD COLUMN labels_state varchar(16) NULL,
      ADD COLUMN alerts_state varchar(16) NULL,
      ADD COLUMN alerts_json json NULL,
      ADD COLUMN reauth_count int NOT NULL DEFAULT 0,
      ADD COLUMN new_messages int NULL,
      ADD COLUMN new_notifications int NULL`);
    await queryRunner.query("ALTER TABLE in_app_notices ADD COLUMN payload_json json NULL");
    await queryRunner.query(`ALTER TABLE file_fetches
      MODIFY actor_user_id varchar(36) NULL,
      ADD COLUMN origin varchar(16) NOT NULL DEFAULT 'user'`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DELETE FROM file_fetches WHERE actor_user_id IS NULL");
    await queryRunner.query("ALTER TABLE file_fetches DROP COLUMN origin, MODIFY actor_user_id varchar(36) NOT NULL");
    await queryRunner.query("ALTER TABLE in_app_notices DROP COLUMN payload_json");
    await queryRunner.query(`ALTER TABLE sync_runs DROP COLUMN new_notifications, DROP COLUMN new_messages,
      DROP COLUMN reauth_count, DROP COLUMN alerts_json, DROP COLUMN alerts_state,
      DROP COLUMN labels_state, DROP COLUMN folders_state, DROP COLUMN boxes_json`);
    await queryRunner.query("DROP TABLE sunat_labels");
    await queryRunner.query("DROP TABLE sunat_folders");
  }
}
