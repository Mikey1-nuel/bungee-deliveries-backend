// config/cors.ts
const envOrigins =
  process.env.ALLOWED_ORIGINS?.split(",").map((o) =>
    o.trim().replace(/\/$/, ""),
  ) ?? [];

export const allowedOrigins = [
  "https://bungee-deliveries.vercel.app",
  "http://localhost:3000",
  ...envOrigins,
];

export const corsOriginCheck = (
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
) => {
  if (!origin || allowedOrigins.includes(origin)) {
    callback(null, true);
  } else {
    callback(new Error(`CORS blocked for origin: ${origin}`));
  }
};
