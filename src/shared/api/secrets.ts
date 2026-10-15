import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt, type ScryptOptions } from "node:crypto";

/** A new webhook key: `wt_` + 32 random bytes. Only its hash is stored. */
export function newWebhookToken(): string {
  return `wt_${randomBytes(32).toString("base64url")}`;
}

export function hashWebhookToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** A share link id: 128 random bits, URL-safe (22 characters). */
export function newShareId(): string {
  return randomBytes(16).toString("base64url");
}

export const SHARE_ID_PATTERN = /^[A-Za-z0-9_-]{22}$/;

// ~32 MB and ~100 ms per try: slow enough to make guessing a leaked row costly.
const SCRYPT: ScryptOptions = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password.normalize("NFC"), salt, 32, SCRYPT, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export type Sealed = { salt: string; iv: string; ciphertext: string };

/** Encrypt with a key derived from the password (scrypt → AES-256-GCM). */
export async function sealWithPassword(plaintext: string, password: string): Promise<Sealed> {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveKey(password, salt);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final(), cipher.getAuthTag()]);
  return { salt: salt.toString("base64"), iv: iv.toString("base64"), ciphertext: body.toString("base64") };
}

/** The plaintext, or `null` when the password is wrong (or the data was altered). */
export async function openWithPassword(sealed: Sealed, password: string): Promise<string | null> {
  try {
    const key = await deriveKey(password, Buffer.from(sealed.salt, "base64"));
    const body = Buffer.from(sealed.ciphertext, "base64");
    if (body.length < 16) return null;
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(sealed.iv, "base64"));
    decipher.setAuthTag(body.subarray(body.length - 16));
    return Buffer.concat([decipher.update(body.subarray(0, body.length - 16)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
