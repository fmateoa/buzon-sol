import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "@buzon-sol/domain";
import { validateFile } from "./files.js";

test("HTML, fake PDF and oversized responses never become stored files", () => {
  for (const response of [
    { status: 200, contentType: "text/html", bytes: Buffer.from("<html>login</html>") },
    { status: 200, contentType: "application/pdf", bytes: Buffer.from("<html>error</html>") },
    { status: 500, contentType: "application/pdf", bytes: Buffer.from("%PDF-1.7") },
  ]) assert.throws(() => validateFile(response), (error) => error instanceof AppError);
  assert.throws(() => validateFile({ status: 200, contentType: "application/pdf", bytes: Buffer.from("%PDF-1.7") }, "attachment", 3));
  assert.equal(validateFile({ status: 200, contentType: "application/pdf", bytes: Buffer.from("%PDF-1.7") }).mime, "application/pdf");
  assert.throws(() => validateFile({ status: 200, contentType: "text/html", bytes: Buffer.from("<html>login</html>") }, "generated_document"));
  const generated = validateFile({ status: 200, contentType: "text/html",
    bytes: Buffer.from("<p>Ficticio</p><script>bad()</script>"), verifiedGeneratedDocument: true }, "generated_document");
  assert.equal(generated.mime, "text/html");
  assert.equal(generated.bytes.includes(Buffer.from("<script>")), false);
});
