/** Platform hosts under yo-coach.app: every other subdomain is a coach's public website (slug.yo-coach.app). */
const PLATFORM_HOSTS = new Set([
  'yo-coach.app',
  'app.yo-coach.app',
  'account.yo-coach.app',
  'integration.yo-coach.app',
  'login.yo-coach.app',
  'login-int.yo-coach.app',
  'minio.yo-coach.app',
  'minio-int.yo-coach.app',
  'minio-console.yo-coach.app',
  'minio-console-int.yo-coach.app',
]);

/**
 * Single source for the app bootstrap, the auth service and the root component (they used to disagree).
 * A coach site is a subdomain of yo-coach.app that is not a platform host, or a coach's own domain (any other
 * host: the app itself is only served on the platform hosts above, localhost and plain IP addresses).
 * Deploying the app on a new host means adding it to PLATFORM_HOSTS, or every page would be taken for a coach site.
 */
export function isPublicCoachHostname(host: string): boolean {
  if (!host) return false;
  const normalized = host.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  if (normalized === 'localhost' || normalized.endsWith('.localhost')) return false;
  if (/^[0-9.]+$/.test(normalized) || normalized.includes(':')) return false;
  if (PLATFORM_HOSTS.has(normalized)) return false;
  return normalized.includes('.');
}
