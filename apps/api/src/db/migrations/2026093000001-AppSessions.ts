import { MigrationInterface, QueryRunner } from "typeorm";

export class AppSessions2026093000001 implements MigrationInterface {
  name = "AppSessions2026093000001";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE app_sessions (
      id varchar(36) PRIMARY KEY,
      user_id varchar(36) NOT NULL,
      token_hash binary(32) NOT NULL UNIQUE,
      created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      expires_at datetime(6) NOT NULL,
      revoked_at datetime(6) NULL,
      KEY ix_sessions_user (user_id, expires_at),
      CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES app_users(id)
    ) ENGINE=InnoDB`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE app_sessions");
  }
}
