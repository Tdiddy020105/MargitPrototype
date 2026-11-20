// The iPad page is the Vite server on this PC. /api stays on that same origin.
// Only the GitHub Pages host calls the PC API on port 3001.
const PC_API = "https://desktop-u5mu3qu.tail4ac3fe.ts.net:3001";

export function apiUrl(path) {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  const host = typeof location !== "undefined" ? location.hostname : "";
  if (import.meta.env.DEV || !host.endsWith("github.io")) return suffix;
  return `${PC_API}${suffix}`;
}

export function publicUrl(path) {
  const base = import.meta.env.BASE_URL || "/";
  const clean = String(path || "").replace(/^\//, "");
  return `${base}${clean}`;
}
