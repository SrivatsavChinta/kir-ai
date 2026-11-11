import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** 32-byte key, base64. Encrypts the Supabase refresh token stored with an OAuth grant. */
export function encryptionKey(): Buffer {
  const raw = process.env.MCP_TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("MCP_TOKEN_ENCRYPTION_KEY is not set. See docs/claude-mcp-setup.md.");
  }
  const decoded = Buffer.from(raw, "base64");
  if (decoded.length !== 32) {
    throw new Error("MCP_TOKEN_ENCRYPTION_KEY must be 32 bytes, base64-encoded.");
  }
  return decoded;
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptSecret(payload: string): string {
  const [version, iv, tag, data] = payload.split(".");
  if (version !== "v1" || !iv || !tag || !data) {
    throw new Error("Stored credential could not be read.");
  }
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

export function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

export function tokensMatch(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
