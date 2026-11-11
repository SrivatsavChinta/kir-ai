/**
 * A same-site path to return to after login. The path itself must stay on this
 * origin. Query values may contain URLs, which the OAuth authorize redirect needs.
 */
export function safeNextPath(value: string | null | undefined): string {
  if (!value) return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  const path = value.split("?")[0] ?? "/";
  if (path.includes("://") || path.startsWith("/login") || path.startsWith("/register")) return "/";
  if (path.split("/").some((part) => part === "..")) return "/";
  return value;
}
