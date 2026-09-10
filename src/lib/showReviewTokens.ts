import "server-only";

import { createHash, randomBytes } from "crypto";

export const createReviewToken = () => randomBytes(32).toString("base64url");

export const hashReviewToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
