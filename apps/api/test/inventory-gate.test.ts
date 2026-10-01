import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import type { DataSource } from "typeorm";
import { InventoryService } from "../src/inventory/inventory";
import type { AuthService, Principal } from "../src/auth/auth";

test("el inventario distingue la puerta cerrada de un fallo remoto", async () => {
  assert.notEqual(process.env.SUNAT_TRANSPORT_VALIDATED, "true");
  const auth = { requireAccount() {} } as unknown as AuthService;
  const service = new InventoryService({} as DataSource, auth);
  await assert.rejects(service.start({} as Principal, "00000000-0000-4000-8000-000000000001"),
    (error: { code?: string }) => error.code === "remote_disabled");
});
