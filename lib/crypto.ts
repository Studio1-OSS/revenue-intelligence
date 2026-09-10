import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { AppError } from "./errors";

function secretKey(secret = process.env.KEY_ENCRYPTION_SECRET) {
  if (!secret || !/^[0-9a-f]{64}$/i.test(secret))
    throw new AppError(
      "ENCRYPTION_NOT_CONFIGURED",
      "Key encryption is not configured.",
      503,
    );
  return Buffer.from(secret, "hex");
}
export function encryptKey(
  value: string,
  workspaceId: string,
  secret?: string,
  purpose = "nebius",
) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey(secret), iv);
  cipher.setAAD(Buffer.from(`${purpose}:${workspaceId}:v1`));
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}
export function decryptKey(
  value: string,
  workspaceId: string,
  secret?: string,
  purpose = "nebius",
) {
  const [version, iv, tag, ciphertext] = value.split(".");
  if (version !== "v1" || !iv || !tag || !ciphertext)
    throw new AppError("KEY_UNREADABLE", "Reconnect the AI key.", 503);
  try {
    const cipher = createDecipheriv(
      "aes-256-gcm",
      secretKey(secret),
      Buffer.from(iv, "base64url"),
    );
    cipher.setAAD(Buffer.from(`${purpose}:${workspaceId}:v1`));
    cipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      cipher.update(Buffer.from(ciphertext, "base64url")),
      cipher.final(),
    ]).toString("utf8");
  } catch {
    throw new AppError("KEY_UNREADABLE", "Reconnect the AI key.", 503);
  }
}
export function validSecret(
  actual: string | null,
  expected: string | undefined,
) {
  if (!actual || !expected || expected.length < 32) return false;
  const a = Buffer.from(actual),
    b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
