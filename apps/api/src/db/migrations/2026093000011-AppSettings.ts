import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Configuraciones: ajustes globales (solo los que difieren del valor por defecto), inactividad de
 * sesión y bloqueo temporal de login. Quien ya gestionaba usuarios y roles recibe el permiso nuevo.
 */
export class AppSettings2026093000011 implements MigrationInterface {
  name = "AppSettings2026093000011";
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE app_settings (
      setting_key varchar(64) PRIMARY KEY,
      value_int int NOT NULL,
      updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      updated_by varchar(36) NULL,
      CONSTRAINT fk_settings_user FOREIGN KEY (updated_by) REFERENCES app_users(id)
    ) ENGINE=InnoDB`);
    await queryRunner.query(`ALTER TABLE app_sessions
      ADD COLUMN last_seen_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)`);
    await queryRunner.query(`ALTER TABLE app_users
      ADD COLUMN failed_logins int NOT NULL DEFAULT 0,
      ADD COLUMN locked_until datetime(6) NULL`);
    await queryRunner.query(`INSERT INTO role_permissions (role_id,permission)
      SELECT role_id,'manage_settings' FROM role_permissions WHERE permission='manage_users_roles'`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DELETE FROM role_permissions WHERE permission='manage_settings'");
    await queryRunner.query("ALTER TABLE app_users DROP COLUMN locked_until, DROP COLUMN failed_logins");
    await queryRunner.query("ALTER TABLE app_sessions DROP COLUMN last_seen_at");
    await queryRunner.query("DROP TABLE app_settings");
  }
}
