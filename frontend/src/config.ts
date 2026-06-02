// Frontend environment config.
//
// Flip ENV to switch which backend the app talks to:
//   "local" -> FastAPI dev server on http://localhost:8000
//   "dev"   -> empty string → relative `/api/*` paths, served by the
//              Cloudflare Pages function in functions/api/[[path]].ts
//              which proxies server-side to wrangler.jsonc's BACKEND_URL.
//              Avoids browser CORS and Firebase Hosting's 60s proxy cap.
export const ENV: "local" | "dev" = "dev";

const BACKEND_URLS = {
  local: "http://localhost:8000",
  dev: "",
} as const;

export const BACKEND_URL: string = BACKEND_URLS[ENV];
