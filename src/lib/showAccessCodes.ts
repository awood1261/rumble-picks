import { createHash, timingSafeEqual } from "crypto";

const ACCESS_CODE_MIN_LENGTH = 3;
const ACCESS_CODE_MAX_LENGTH = 64;

export const normalizeShowAccessCode = (value: string) =>
  value.trim().replace(/\s+/g, " ").toUpperCase();

export const validateShowAccessCodeInput = (value: string) => {
  const normalized = normalizeShowAccessCode(value);
  if (normalized.length < ACCESS_CODE_MIN_LENGTH) {
    return {
      ok: false as const,
      error: `Access code must be at least ${ACCESS_CODE_MIN_LENGTH} characters.`,
    };
  }
  if (normalized.length > ACCESS_CODE_MAX_LENGTH) {
    return {
      ok: false as const,
      error: `Access code must be ${ACCESS_CODE_MAX_LENGTH} characters or fewer.`,
    };
  }
  return { ok: true as const, value: normalized };
};

export const hashShowAccessCode = (value: string) => {
  const normalized = normalizeShowAccessCode(value);
  const pepper = process.env.SHOW_ACCESS_CODE_PEPPER ?? "";
  return createHash("sha256")
    .update(`${pepper}:${normalized}`, "utf8")
    .digest("hex");
};

export const verifyShowAccessCode = (
  submittedCode: string,
  expectedHash: string | null | undefined
) => {
  if (!expectedHash) return false;
  const submittedHash = hashShowAccessCode(submittedCode);
  const submitted = Buffer.from(submittedHash, "hex");
  const expected = Buffer.from(expectedHash, "hex");
  if (submitted.length !== expected.length) return false;
  return timingSafeEqual(submitted, expected);
};
