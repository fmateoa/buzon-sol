import { MigrationInterface, QueryRunner } from "typeorm";

export class FileFetches2026093000007 implements MigrationInterface {
  name = "FileFetches2026093000007";
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE file_fetches (
      id varchar(36) PRIMARY KEY,
      file_id varchar(36) NOT NULL,
      account_id varchar(36) NOT NULL,
      actor_user_id varchar(36) NOT NULL,
      status varchar(24) NOT NULL,
      error_code varchar(40) NULL,
      created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      finished_at datetime(6) NULL,
      KEY ix_fetch_file_created (file_id,created_at),
      CONSTRAINT fk_fetch_file FOREIGN KEY (file_id) REFERENCES file_assets(id),
      CONSTRAINT fk_fetch_account FOREIGN KEY (account_id) REFERENCES sunat_accounts(id),
      CONSTRAINT fk_fetch_actor FOREIGN KEY (actor_user_id) REFERENCES app_users(id)
    ) ENGINE=InnoDB`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE file_fetches");
  }
}
