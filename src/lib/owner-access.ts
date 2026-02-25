import { createHash, timingSafeEqual } from "node:crypto";

export const OWNER_UNLOCK_COOKIE = "pys_owner_unlock";

function normalizeValue(value: string): string {
  return value.trim().toLowerCase();
}

function parseCsvAllowlist(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((entry) => normalizeValue(entry))
      .filter(Boolean)
  );
}

function getOwnerEmailAllowlist(): Set<string> {
  return parseCsvAllowlist(process.env.OWNER_EMAILS);
}

function getOwnerUsernameAllowlist(): Set<string> {
  return parseCsvAllowlist(process.env.OWNER_USERNAMES);
}

function getOwnerSecret(): string | null {
  const secret = process.env.OWNER_SECRET_PASSWORD?.trim();
  return secret ? secret : null;
}

function safeEqualText(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function getOwnerUnlockCookieValue(): string | null {
  const secret = getOwnerSecret();
  if (!secret) return null;
  return createHash("sha256").update(secret).digest("hex");
}

export function hasOwnerSecretConfigured(): boolean {
  return getOwnerSecret() !== null;
}

export function shouldShowOwnerTools({
  email,
  username,
}: {
  email?: string | null;
  username?: string | null;
}): boolean {
  return (
    isOwnerByIdentity({ email, username }) || hasOwnerSecretConfigured()
  );
}

export function isOwnerByIdentity({
  email,
  username,
}: {
  email?: string | null;
  username?: string | null;
}): boolean {
  const normalizedEmail = email ? normalizeValue(email) : null;
  const normalizedUsername = username ? normalizeValue(username) : null;

  const emailAllowlist = getOwnerEmailAllowlist();
  const usernameAllowlist = getOwnerUsernameAllowlist();

  const emailMatch =
    normalizedEmail !== null && emailAllowlist.has(normalizedEmail);
  const usernameMatch =
    normalizedUsername !== null && usernameAllowlist.has(normalizedUsername);

  return emailMatch || usernameMatch;
}

export function isOwnerSecretValid(password: string): boolean {
  const secret = getOwnerSecret();
  if (!secret) return false;
  return safeEqualText(password, secret);
}

export function isOwnerUnlockedByCookie(cookieValue: string | null): boolean {
  const expected = getOwnerUnlockCookieValue();
  if (!expected || !cookieValue) return false;
  return safeEqualText(cookieValue, expected);
}

export function createOwnerUnlockCookie(): string | null {
  return getOwnerUnlockCookieValue();
}
