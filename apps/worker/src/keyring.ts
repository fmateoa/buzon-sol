import { decryptInWorker, envelopeKeyId } from "@buzon-sol/domain";

const pem = (value: string | undefined) => value?.replace(/\\n/g, "\n");

/**
 * During a rotation the worker holds the new key (`SOL_PRIVATE_KEY_PEM`) and, temporarily, the previous one
 * (`SOL_PREVIOUS_KEY_ID` + `SOL_PREVIOUS_PRIVATE_KEY_PEM`). Envelopes name their key; others use the current key.
 */
export function privateKeyFor(keyId: string): string {
  const previousId = process.env.SOL_PREVIOUS_KEY_ID;
  const previous = pem(process.env.SOL_PREVIOUS_PRIVATE_KEY_PEM);
  if (previousId && keyId === previousId && previous) return previous;
  const current = pem(process.env.SOL_PRIVATE_KEY_PEM);
  if (!current) throw new Error("Worker private key is not configured");
  return current;
}

export function openEnvelope(encrypted: Buffer): string {
  return decryptInWorker(encrypted, privateKeyFor(envelopeKeyId(encrypted)));
}
