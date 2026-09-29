/**
 * Only same-site relative paths are allowed as post-login destinations
 * (prevents open redirects such as ?next=//evil.example or ?next=https://…).
 */
export function safeReturnPath(value: string | null | undefined, fallback = "/account"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(value)) return fallback;
  return value;
}
