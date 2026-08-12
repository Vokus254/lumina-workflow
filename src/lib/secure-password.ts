import { randomBytes } from "crypto";

export function generateTemporaryPassword(bytes = 18): string {
  return randomBytes(bytes).toString("base64url");
}
