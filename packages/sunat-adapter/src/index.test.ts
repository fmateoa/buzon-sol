import assert from "node:assert/strict";
import test from "node:test";
import { AppError, type MailBox } from "@buzon-sol/domain";
import { parseInventoryPage, scanBox, type InventoryClient, type ScanPage } from "./index.js";

const json = (rows: object[], total = 108, records = 2681) => ({
  contentType: "application/json;charset=UTF-8", body: JSON.stringify({ total, records, rows }),
});

test("3328 and 227 rows survive false declared totals and empty confirmation", async () => {
  const calls: Record<string, number> = {};
  const client: InventoryClient = {
    async listPage(box: MailBox, page: number) {
      const key = `${box}:${page}`;
      calls[key] = (calls[key] ?? 0) + 1;
      const count = box === "messages" ? 3328 : 227;
      const start = (page - 1) * 25;
      return json(Array.from({ length: Math.max(0, Math.min(25, count - start)) }, (_, index) => ({
        codMensaje: start + index + 1, indTipmsj: box === "messages" ? 1 : 2, indEstado: 0,
      })), box === "messages" ? 108 : 10, box === "messages" ? 2681 : 227);
    },
  };
  const pages: ScanPage[] = [];
  await scanBox(client, "messages", async (page) => { pages.push(page); });
  await scanBox(client, "notifications", async (page) => { pages.push(page); });
  assert.equal(pages.filter((p) => p.box === "messages" && !p.confirmedEmpty).reduce((sum, p) => sum + p.received, 0), 3328);
  assert.equal(pages.filter((p) => p.box === "notifications" && !p.confirmedEmpty).reduce((sum, p) => sum + p.received, 0), 227);
  assert.equal(calls["messages:135"], 2);
  assert.equal(calls["notifications:11"], 2);
  assert.equal(pages.at(-1)?.confirmedEmpty, true);
});

test("transient empty page is retried; a failed page is not persisted", async () => {
  let hits = 0;
  const pages: ScanPage[] = [];
  const client: InventoryClient = { async listPage(_box, page) {
    if (page === 1) return json([{ codMensaje: 1, indEstado: 0 }]);
    if (page === 2 && ++hits === 1) return json([]);
    if (page === 2) return json([{ codMensaje: 2, indEstado: 0 }]);
    if (page === 3) throw new AppError("remote_unavailable");
    return json([]);
  } };
  await assert.rejects(scanBox(client, "messages", async (page) => { pages.push(page); }),
    (error) => error instanceof AppError && error.code === "remote_unavailable");
  assert.deepEqual(pages.map((p) => p.page), [1, 2]);
  assert.equal(pages[1].rows[0].codMensaje, "2");
});

test("HTML, rows null and page guardrail never become a successful empty mailbox", async () => {
  assert.throws(() => parseInventoryPage({ contentType: "text/html", body: "<html>login</html>" }, "messages"),
    (error) => error instanceof AppError && error.code === "remote_session_expired");
  assert.throws(() => parseInventoryPage({ contentType: "application/json", body: '{"rows":null}' }, "messages"),
    (error) => error instanceof AppError && error.code === "remote_session_expired");
  await assert.rejects(scanBox({ listPage: async () => json([{ codMensaje: 1, indEstado: 0 }]) },
    "messages", async () => {}, 1, 2),
    (error) => error instanceof AppError && error.code === "incomplete_inventory");
});

test("label queries mix boxes only when the caller opts in", () => {
  const mixed = json([{ codMensaje: 1, indTipmsj: 1, indEstado: 1 }, { codMensaje: 2, indTipmsj: 2, indEstado: 1 }]);
  assert.equal(parseInventoryPage(mixed, "any").rows.length, 2);
  assert.throws(() => parseInventoryPage(mixed, "messages"), (error) => error instanceof AppError && error.code === "schema_changed");
});
