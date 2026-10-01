import { DataSource } from "typeorm";

/** The schema is owned by the API migrations; the worker never synchronizes or migrates. */
export function workerDataSource(): DataSource {
  return new DataSource({
    type: "mysql", host: process.env.DB_HOST ?? "127.0.0.1", port: Number(process.env.DB_PORT ?? 3306),
    username: process.env.DB_USER ?? "buzon", password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME ?? "buzon_sol", charset: "utf8mb4", timezone: "Z",
    synchronize: false, migrationsRun: false,
  });
}
