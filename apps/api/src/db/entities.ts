import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity("roles")
export class RoleEntity {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Index({ unique: true }) @Column({ type: "varchar", length: 100 }) name!: string;
  @Column({ name: "all_accounts", type: "boolean", default: false }) allAccounts!: boolean;
}

@Entity("app_users")
export class UserEntity {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Index({ unique: true }) @Column({ type: "varchar", length: 254 }) email!: string;
  @Column({ type: "varchar", length: 160 }) name!: string;
  @Column({ name: "password_hash", type: "varchar", length: 255 }) passwordHash!: string;
  @Column({ type: "varchar", length: 16 }) status!: "active" | "invited" | "disabled";
  @Column({ name: "role_id", type: "varchar", length: 36 }) roleId!: string;
  @Column({ name: "read_warning_enabled", type: "boolean", default: true }) readWarningEnabled!: boolean;
}

@Entity("sunat_accounts")
export class AccountEntity {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ type: "varchar", length: 160 }) alias!: string;
  @Column({ name: "ruc_ciphertext", type: "blob" }) rucCiphertext!: Buffer;
  @Column({ name: "sol_user_ciphertext", type: "blob" }) solUserCiphertext!: Buffer;
  @Column({ type: "boolean", default: true }) active!: boolean;
}

@Entity("sunat_credentials")
export class CredentialEntity {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ name: "account_id", type: "varchar", length: 36 }) accountId!: string;
  @Column({ type: "int" }) version!: number;
  @Column({ type: "blob", select: false }) ciphertext!: Buffer;
  @Column({ type: "binary", length: 12, select: false }) nonce!: Buffer;
  @Column({ name: "key_id", type: "varchar", length: 100, select: false }) keyId!: string;
  @Column({ type: "varchar", length: 16 }) status!: "untested" | "valid" | "rejected";
}

@Entity("mail_items")
@Index("uq_mail_identity", ["accountId", "tipoMsj", "codMensaje"], { unique: true })
export class MailItemEntity {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ name: "account_id", type: "varchar", length: 36 }) accountId!: string;
  @Column({ name: "tipo_msj", type: "tinyint" }) tipoMsj!: 1 | 2;
  @Column({ name: "cod_mensaje", type: "varchar", length: 80 }) codMensaje!: string;
  @Column({ name: "ind_estado", type: "int" }) indEstado!: number;
  @Column({ name: "subject_text", type: "text", nullable: true }) subjectText!: string | null;
  @Column({ name: "published_at_text", type: "varchar", length: 64, nullable: true }) publishedAtText!: string | null;
  @Column({ name: "row_json", type: "json" }) rowJson!: Record<string, unknown>;
}
