import "reflect-metadata";
import { DataSource } from "typeorm";
import { InitialSchema2026093000000 } from "./migrations/2026093000000-InitialSchema";
import { AppSessions2026093000001 } from "./migrations/2026093000001-AppSessions";
import { AccountLookup2026093000002 } from "./migrations/2026093000002-AccountLookup";
import { ScheduleOptions2026093000003 } from "./migrations/2026093000003-ScheduleOptions";
import { SyncFailures2026093000004 } from "./migrations/2026093000004-SyncFailures";
import { FileSource2026093000005 } from "./migrations/2026093000005-FileSource";
import { ConnectionTests2026093000006 } from "./migrations/2026093000006-ConnectionTests";
import { FileFetches2026093000007 } from "./migrations/2026093000007-FileFetches";
import { MailListing2026093000008 } from "./migrations/2026093000008-MailListing";
import { CatalogsAndNotices2026093000009 } from "./migrations/2026093000009-CatalogsAndNotices";
import { AccountEntity, CredentialEntity, MailItemEntity, RoleEntity, UserEntity } from "./entities";

const dataSource = new DataSource({
  type: "mysql",
  host: process.env.DB_HOST ?? "127.0.0.1",
  port: Number(process.env.DB_PORT ?? 3306),
  username: process.env.DB_USER ?? "buzon",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME ?? "buzon_sol",
  charset: "utf8mb4",
  timezone: "Z",
  synchronize: false,
  migrationsRun: false,
  entities: [AccountEntity, CredentialEntity, MailItemEntity, RoleEntity, UserEntity],
  migrations: [InitialSchema2026093000000, AppSessions2026093000001, AccountLookup2026093000002, ScheduleOptions2026093000003, SyncFailures2026093000004, FileSource2026093000005, ConnectionTests2026093000006, FileFetches2026093000007, MailListing2026093000008, CatalogsAndNotices2026093000009],
});

export default dataSource;
