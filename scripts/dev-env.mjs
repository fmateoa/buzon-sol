// Writes .env.dev with random local-only secrets for compose.dev.yml. Refuses to overwrite an existing file.
// Nothing here is a real SUNAT credential; SOL secrets are entered later through the API.
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";

const target = new URL("../.env.dev", import.meta.url);
if (existsSync(target)) {
  console.error(".env.dev already exists; delete it first to regenerate local secrets.");
  process.exit(1);
}
const secret = () => randomBytes(24).toString("base64url");
const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 3072 });
const oneLine = (pem) => pem.trim().replaceAll("\n", "\\n");
const dbPassword = secret(), s3User = `buzon${randomBytes(4).toString("hex")}`, s3Password = secret();
const lines = {
  MYSQL_ROOT_PASSWORD: secret(), MYSQL_PASSWORD: dbPassword, DB_PASSWORD: dbPassword,
  MINIO_ROOT_USER: s3User, MINIO_ROOT_PASSWORD: s3Password, S3_ACCESS_KEY: s3User, S3_SECRET_KEY: s3Password,
  SOL_KEY_ID: `dev-${new Date().toISOString().slice(0, 10)}`,
  SOL_PUBLIC_KEY_PEM: oneLine(publicKey.export({ format: "pem", type: "spki" }).toString()),
  // Only the worker needs this in a real deployment; the shared dev env file is a local convenience.
  SOL_PRIVATE_KEY_PEM: oneLine(privateKey.export({ format: "pem", type: "pkcs8" }).toString()),
  ACCOUNT_FINGERPRINT_KEY_B64: randomBytes(32).toString("base64"),
};
writeFileSync(target, Object.entries(lines).map(([key, value]) => `${key}=${value}`).join("\n") + "\n", { mode: 0o600 });
console.log("Wrote .env.dev with local development secrets.");
