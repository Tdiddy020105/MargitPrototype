// GitHub Pages is static. Chat and speech stay on the PC.
// Dev uses the Vite /api proxy. The built page calls the PC over Tailscale.
const PC_API = "https://desktop-u5mu3qu.tail4ac3fe.ts.net:3001";

export function apiUrl(path) {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  if (import.meta.env.DEV) return suffix;
  return `${PC_API}${suffix}`;
}

export function publicUrl(path) {
  const base = import.meta.env.BASE_URL || "/";
  const clean = String(path || "").replace(/^\//, "");
  return `${base}${clean}`;
}
