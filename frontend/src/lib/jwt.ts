/** Decodes the payload of a JWT without verifying it -- fine for reading
 * non-sensitive display data (email) client-side; the backend still
 * verifies the signature on every real request. */
export function decodeJwtEmail(token: string | null): string | null {
  if (!token) return null
  try {
    const payload = token.split('.')[1]
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    return decoded.email ?? null
  } catch {
    return null
  }
}