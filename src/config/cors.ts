// config/cors.ts — new file
const envOrigins =
  process.env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) ?? [];

export const allowedOrigins = ["http://localhost:3000", ...envOrigins];
