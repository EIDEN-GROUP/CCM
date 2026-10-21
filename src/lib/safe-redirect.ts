/**
 * A redirect that cannot leave the application.
 *
 * The sign-in form carries a `next` parameter so a person lands back where
 * they were. Without a check, a crafted link — `/login?next=https://evil.test`
 * — would send a person who has just typed their password to somebody else's
 * site. That is a phishing primitive, so the path is validated rather than
 * trusted.
 *
 * The rules are deliberately strict:
 *
 *   - it must start with a single `/`;
 *   - `//host` is protocol-relative and leaves the site, so it is refused;
 *   - a backslash is normalised to a slash by some browsers, so it is
 *     refused too;
 *   - anything that is not a path falls back to the default.
 */
export function safeInternalPath(
  value: string | null | undefined,
  fallback = "/overview",
): string {
  if (typeof value !== "string") return fallback;

  const candidate = value.trim();

  if (candidate.length === 0) return fallback;
  if (!candidate.startsWith("/")) return fallback;
  if (candidate.startsWith("//")) return fallback;
  if (candidate.includes("\\")) return fallback;
  // A control character can be used to smuggle a newline into a header.
  if (/[\u0000-\u001f\u007f]/.test(candidate)) return fallback;

  return candidate;
}
