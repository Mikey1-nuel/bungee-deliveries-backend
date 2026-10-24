// config/cors.ts
const envOrigins =
  process.env.ALLOWED_ORIGINS?.split(",").map((o) =>
    o.trim().replace(/\/$/, ""),
  ) ?? []; // strip any trailing slash

export const allowedOrigins = ["https://bungee-deliveries.vercel.app", "http://localhost:3000", ...envOrigins];
