// Frontend environment config.
//
// Flip ENV to switch which backend the app talks to:
//   "local" -> FastAPI dev server on http://localhost:8000
//   "dev"   -> Firebase-hosted backend (Cloud Function via Firebase Hosting)
export const ENV: "local" | "dev" = "dev";

const BACKEND_URLS = {
  local: "http://localhost:8000",
  dev: "https://lyzr-ai-demo.web.app",
} as const;

export const BACKEND_URL: string = BACKEND_URLS[ENV];
