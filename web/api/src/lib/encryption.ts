import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;

function getKey(): Buffer {
  const raw = process.env.BILLING_ENCRYPTION_KEY ?? "";
  if (!raw || raw.length < 32) {
    throw new Error("BILLING_ENCRYPTION_KEY must be set (min 32 chars)");
  }
  return Buffer.from(raw.slice(0, 32), "utf8");
}

/** Returns "ivHex:tagHex:ciphertextHex" — never log the output. */
export function encryptField(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("hex"), tag.toString("hex"), encrypted.toString("hex")].join(":");
}

export function decryptField(stored: string): string {
  const parts = stored.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted field format");
  const [ivHex, tagHex, ctHex] = parts as [string, string, string];
  const key = getKey();
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const ct = Buffer.from(ctHex, "hex");
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ct), decipher.final()]);
  return decrypted.toString("utf8");
}

/** Returns partially masked TC No for display: "***45678901" */
export function maskTcNo(tcNo: string): string {
  if (tcNo.length !== 11) return "***********";
  return `***${tcNo.slice(3)}`;
}
