import { MigrationInterface, QueryRunner } from "typeorm";

/** Schema changes run only through the migration command, never at API startup. */
export class InitialSchema2026093000000 implements MigrationInterface {
  name = "InitialSchema2026093000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    const statements = [
      `CREATE TABLE roles (
        id varchar(36) PRIMARY KEY, name varchar(100) NOT NULL UNIQUE,
        all_accounts boolean NOT NULL DEFAULT false
      ) ENGINE=InnoDB`,
      `CREATE TABLE sunat_accounts (
        id varchar(36) PRIMARY KEY, alias varchar(160) NOT NULL,
        ruc_ciphertext blob NOT NULL, sol_user_ciphertext blob NOT NULL,
        active boolean NOT NULL DEFAULT true,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        disabled_at datetime(6) NULL
      ) ENGINE=InnoDB`,
      `CREATE TABLE role_permissions (
        role_id varchar(36) NOT NULL, permission varchar(40) NOT NULL,
        PRIMARY KEY (role_id, permission),
        CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles(id)
      ) ENGINE=InnoDB`,
      `CREATE TABLE role_sunat_accounts (
        role_id varchar(36) NOT NULL, account_id varchar(36) NOT NULL,
        PRIMARY KEY (role_id, account_id),
        CONSTRAINT fk_role_accounts_role FOREIGN KEY (role_id) REFERENCES roles(id),
        CONSTRAINT fk_role_accounts_account FOREIGN KEY (account_id) REFERENCES sunat_accounts(id)
      ) ENGINE=InnoDB`,
      `CREATE TABLE app_users (
        id varchar(36) PRIMARY KEY, email varchar(254) NOT NULL UNIQUE,
        name varchar(160) NOT NULL, password_hash varchar(255) NOT NULL,
        status varchar(16) NOT NULL, role_id varchar(36) NOT NULL,
        read_warning_enabled boolean NOT NULL DEFAULT true,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id)
      ) ENGINE=InnoDB`,
      `CREATE TABLE sunat_credentials (
        id varchar(36) PRIMARY KEY, account_id varchar(36) NOT NULL,
        version int NOT NULL, ciphertext blob NOT NULL, nonce binary(12) NOT NULL,
        key_id varchar(100) NOT NULL, status varchar(16) NOT NULL,
        replaced_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        UNIQUE KEY uq_credential_version (account_id, version),
        CONSTRAINT fk_credentials_account FOREIGN KEY (account_id) REFERENCES sunat_accounts(id)
      ) ENGINE=InnoDB`,
      `CREATE TABLE sync_schedules (
        id varchar(36) PRIMARY KEY, account_id varchar(36) NOT NULL UNIQUE,
        frequency varchar(16) NOT NULL, days_json json NOT NULL,
        window_start time NOT NULL, window_end time NOT NULL,
        boxes_json json NOT NULL, timezone varchar(64) NOT NULL DEFAULT 'America/Lima',
        state varchar(16) NOT NULL DEFAULT 'disabled',
        remote_effect_accepted boolean NOT NULL DEFAULT false,
        next_run_at datetime(6) NULL,
        CONSTRAINT fk_schedule_account FOREIGN KEY (account_id) REFERENCES sunat_accounts(id)
      ) ENGINE=InnoDB`,
      `CREATE TABLE sync_runs (
        id varchar(36) PRIMARY KEY, account_id varchar(36) NOT NULL,
        mode varchar(16) NOT NULL, state varchar(16) NOT NULL,
        started_at datetime(6) NULL, finished_at datetime(6) NULL,
        resume_box tinyint NULL, resume_page int NULL,
        pause_reason varchar(40) NULL, error_code varchar(40) NULL,
        UNIQUE KEY uq_run_account (id, account_id),
        KEY ix_runs_account_started (account_id, started_at),
        CONSTRAINT fk_runs_account FOREIGN KEY (account_id) REFERENCES sunat_accounts(id)
      ) ENGINE=InnoDB`,
      `CREATE TABLE sync_pages (
        id varchar(36) PRIMARY KEY, run_id varchar(36) NOT NULL,
        account_id varchar(36) NOT NULL, tipo_msj tinyint NOT NULL,
        page_number int NOT NULL, rows_received int NOT NULL,
        unique_rows int NOT NULL, declared_records int NULL,
        declared_pages int NULL, confirmed_empty boolean NOT NULL DEFAULT false,
        completed_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        UNIQUE KEY uq_run_page (run_id, tipo_msj, page_number),
        CONSTRAINT fk_pages_run FOREIGN KEY (run_id, account_id) REFERENCES sync_runs(id, account_id),
        CONSTRAINT fk_pages_account FOREIGN KEY (account_id) REFERENCES sunat_accounts(id)
      ) ENGINE=InnoDB`,
      `CREATE TABLE mail_items (
        id varchar(36) PRIMARY KEY, account_id varchar(36) NOT NULL,
        tipo_msj tinyint NOT NULL, cod_mensaje varchar(80) NOT NULL,
        ind_estado int NOT NULL, subject_text text NULL,
        published_at_text varchar(64) NULL, row_json json NOT NULL,
        first_seen_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        last_seen_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        UNIQUE KEY uq_mail_identity (account_id, tipo_msj, cod_mensaje),
        UNIQUE KEY uq_mail_account (id, account_id),
        KEY ix_mail_box_state (account_id, tipo_msj, ind_estado, last_seen_at),
        CONSTRAINT fk_mail_account FOREIGN KEY (account_id) REFERENCES sunat_accounts(id)
      ) ENGINE=InnoDB`,
      `CREATE TABLE mail_details (
        item_id varchar(36) PRIMARY KEY, account_id varchar(36) NOT NULL,
        original_body longtext NULL, safe_body longtext NULL,
        detail_json json NULL, fetched_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        CONSTRAINT fk_details_item FOREIGN KEY (item_id, account_id) REFERENCES mail_items(id, account_id)
      ) ENGINE=InnoDB`,
      `CREATE TABLE mail_read_events (
        id varchar(36) PRIMARY KEY, item_id varchar(36) NOT NULL,
        account_id varchar(36) NOT NULL, actor_user_id varchar(36) NULL,
        idempotency_key varchar(100) NOT NULL, status varchar(24) NOT NULL,
        remote_before int NULL, remote_after int NULL, update_leido boolean NULL,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        finished_at datetime(6) NULL,
        UNIQUE KEY uq_read_intent (item_id, idempotency_key),
        CONSTRAINT fk_read_item FOREIGN KEY (item_id, account_id) REFERENCES mail_items(id, account_id),
        CONSTRAINT fk_read_actor FOREIGN KEY (actor_user_id) REFERENCES app_users(id)
      ) ENGINE=InnoDB`,
      `CREATE TABLE mail_reviews (
        user_id varchar(36) NOT NULL, item_id varchar(36) NOT NULL,
        account_id varchar(36) NOT NULL, reviewed boolean NOT NULL,
        reviewed_at datetime(6) NULL,
        PRIMARY KEY (user_id, item_id),
        CONSTRAINT fk_review_user FOREIGN KEY (user_id) REFERENCES app_users(id),
        CONSTRAINT fk_review_item FOREIGN KEY (item_id, account_id) REFERENCES mail_items(id, account_id)
      ) ENGINE=InnoDB`,
      `CREATE TABLE file_assets (
        id varchar(36) PRIMARY KEY, item_id varchar(36) NOT NULL,
        account_id varchar(36) NOT NULL, kind varchar(24) NOT NULL,
        position_index int NOT NULL, cod_archivo varchar(80) NULL,
        original_name varchar(255) NULL, object_key varchar(255) NULL,
        mime_type varchar(160) NULL, size_bytes bigint NULL,
        sha256 char(64) NULL, state varchar(20) NOT NULL,
        UNIQUE KEY uq_file_position (item_id, kind, position_index),
        CONSTRAINT fk_asset_item FOREIGN KEY (item_id, account_id) REFERENCES mail_items(id, account_id)
      ) ENGINE=InnoDB`,
      `CREATE TABLE audit_events (
        id varchar(36) PRIMARY KEY, actor_user_id varchar(36) NULL,
        account_id varchar(36) NULL, action varchar(40) NOT NULL,
        object_type varchar(40) NOT NULL, object_id varchar(36) NULL,
        change_json json NULL, created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        KEY ix_audit_account_created (account_id, created_at),
        CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES app_users(id),
        CONSTRAINT fk_audit_account FOREIGN KEY (account_id) REFERENCES sunat_accounts(id)
      ) ENGINE=InnoDB`,
      `CREATE TABLE in_app_notices (
        id varchar(36) PRIMARY KEY, account_id varchar(36) NOT NULL,
        user_id varchar(36) NOT NULL, kind varchar(40) NOT NULL,
        read_at datetime(6) NULL,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        KEY ix_notice_user (user_id, read_at, created_at),
        CONSTRAINT fk_notice_account FOREIGN KEY (account_id) REFERENCES sunat_accounts(id),
        CONSTRAINT fk_notice_user FOREIGN KEY (user_id) REFERENCES app_users(id)
      ) ENGINE=InnoDB`,
    ];
    for (const statement of statements) await queryRunner.query(statement);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      "in_app_notices", "audit_events", "file_assets", "mail_reviews",
      "mail_read_events", "mail_details", "mail_items", "sync_pages",
      "sync_runs", "sync_schedules", "sunat_credentials", "app_users",
      "role_sunat_accounts", "role_permissions", "sunat_accounts", "roles",
    ]) await queryRunner.query(`DROP TABLE ${table}`);
  }
}
