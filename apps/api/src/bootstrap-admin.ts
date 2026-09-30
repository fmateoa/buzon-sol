import { randomUUID } from "node:crypto";
import argon2 from "argon2";
import { PERMISSIONS } from "@buzon-sol/domain";
import dataSource from "./db/data-source";
import { normalizeEmail } from "./auth";

async function main(): Promise<void> {
  const email = normalizeEmail(process.env.BOOTSTRAP_EMAIL);
  const name = process.env.BOOTSTRAP_NAME?.trim();
  if (!name || name.length > 160) throw new Error("BOOTSTRAP_NAME is required");
  let password = "";
  for await (const chunk of process.stdin) password += chunk.toString();
  password = password.replace(/[\r\n]+$/, "");
  if (password.length < 12) throw new Error("Password from stdin must be at least 12 characters");
  const hash = await argon2.hash(password, { type: argon2.argon2id });
  password = "";
  await dataSource.initialize();
  try {
    await dataSource.transaction(async (manager) => {
      const users: { count: number }[] = await manager.query("SELECT COUNT(*) AS count FROM app_users");
      if (Number(users[0].count) !== 0) throw new Error("Bootstrap is only allowed before the first user");
      const roleId = randomUUID();
      const userId = randomUUID();
      await manager.query("INSERT INTO roles (id,name,all_accounts) VALUES (?,?,true)", [roleId, "Administrador"]);
      for (const permission of PERMISSIONS) {
        await manager.query("INSERT INTO role_permissions (role_id,permission) VALUES (?,?)", [roleId, permission]);
      }
      await manager.query(
        "INSERT INTO app_users (id,email,name,password_hash,status,role_id) VALUES (?,?,?,?,?,?)",
        [userId, email, name, hash, "active", roleId],
      );
      await manager.query(
        "INSERT INTO audit_events (id,actor_user_id,action,object_type,object_id) VALUES (?,?,?,?,?)",
        [randomUUID(), userId, "bootstrap", "user", userId],
      );
    });
  } finally {
    await dataSource.destroy();
  }
  process.stdout.write("Initial administrator created\n");
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Bootstrap failed"}\n`);
  process.exitCode = 1;
});
