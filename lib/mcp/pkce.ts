import { createHash, timingSafeEqual } from "node:crypto";

const CLAUDE_REDIRECTS = new Set([
  "https://claude.ai/api/mcp/auth_callback",
  "https://claude.com/api/mcp/auth_callback",
]);

function isLoopback(url: URL): boolean {
  return url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]");
}

/** Redirects Claude's hosted apps and Claude Code's loopback callback may use. */
export function isAllowedRedirect(uri: string): boolean {
  if (CLAUDE_REDIRECTS.has(uri)) return true;
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }
  if (url.username || url.password || url.hash) return false;
  return isLoopback(url);
}

/**
 * Exact match, except loopback redirects ignore the port. Claude Code binds a
 * new port each session and registers `http://localhost/callback` without one.
 */
export function redirectMatches(registered: string, requested: string): boolean {
  if (registered === requested) return true;
  let expected: URL;
  let actual: URL;
  try {
    expected = new URL(registered);
    actual = new URL(requested);
  } catch {
    return false;
  }
  if (!isLoopback(expected) || !isLoopback(actual)) return false;
  return (
    expected.protocol === actual.protocol &&
    expected.hostname === actual.hostname &&
    expected.pathname === actual.pathname &&
    expected.search === actual.search
  );
}

export function verifyPkce(verifier: string, challenge: string): boolean {
  if (verifier.length < 43 || verifier.length > 128) return false;
  if (!/^[\w.~-]+$/.test(verifier)) return false;
  const digest = createHash("sha256").update(verifier).digest("base64url");
  const left = Buffer.from(digest);
  const right = Buffer.from(challenge);
  return left.length === right.length && timingSafeEqual(left, right);
}
