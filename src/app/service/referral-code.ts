/**
 * AFF-10: the referral code of the link that brought a coach to the sign-up (?ref=CODE). Kept in this browser for 30
 * days, so that it survives a detour by the plans page. Only the code is kept, nothing about the referring coach.
 */
const STORAGE_KEY = 'yocoach.referral';
const KEEP_MS = 30 * 24 * 60 * 60 * 1000;
const CODE_FORMAT = /^[A-Za-z0-9][A-Za-z0-9-]{2,18}[A-Za-z0-9]$/;

/** Upper case, or null when it cannot be a code (4 to 20 letters, digits or dashes). */
export function normalizeReferralCode(value: string | null | undefined): string | null {
  const code = (value ?? '').trim();
  return CODE_FORMAT.test(code) && !code.includes('--') ? code.toUpperCase() : null;
}

export function rememberReferralCode(code: string, now = Date.now()): void {
  const normalized = normalizeReferralCode(code);
  if (!normalized) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ code: normalized, expiresAt: now + KEEP_MS }));
  } catch {
    // private browsing: the code stays in the page only
  }
}

export function storedReferralCode(now = Date.now()): string | null {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as { code?: string; expiresAt?: number } | null;
    if (!value || typeof value.expiresAt !== 'number' || value.expiresAt <= now) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return normalizeReferralCode(value.code);
  } catch {
    return null;
  }
}

export function forgetReferralCode(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // nothing kept
  }
}
