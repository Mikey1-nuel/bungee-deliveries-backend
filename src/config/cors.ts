// config/cors.ts
const envOrigins =
  process.env.ALLOWED_ORIGINS?.split(",").map((o) =>
    o.trim().replace(/\/$/, ""),
  ) ?? []; // strip any trailing slash

export const allowedOrigins = ["http://localhost:3000", ...envOrigins];
