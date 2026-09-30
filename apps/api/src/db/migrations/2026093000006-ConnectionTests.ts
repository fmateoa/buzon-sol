import { MigrationInterface, QueryRunner } from "typeorm";

export class ConnectionTests2026093000006 implements MigrationInterface {
  name = "ConnectionTests2026093000006";
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE connection_tests (
      id varchar(36) PRIMARY KEY,
      account_id varchar(36) NOT NULL,
      credential_id varchar(36) NOT NULL,
      actor_user_id varchar(36) NOT NULL,
      status varchar(24) NOT NULL,
      error_code varchar(40) NULL,
      created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      finished_at datetime(6) NULL,
      KEY ix_connection_account_created (account_id,created_at),
      CONSTRAINT fk_connection_account FOREIGN KEY (account_id) REFERENCES sunat_accounts(id),
      CONSTRAINT fk_connection_credential FOREIGN KEY (credential_id) REFERENCES sunat_credentials(id),
      CONSTRAINT fk_connection_actor FOREIGN KEY (actor_user_id) REFERENCES app_users(id)
    ) ENGINE=InnoDB`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE connection_tests");
  }
}
