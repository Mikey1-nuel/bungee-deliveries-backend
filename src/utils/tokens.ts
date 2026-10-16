import jwt from "jsonwebtoken";
import { redis } from "../config/redis";

const ACCESS_SECRET = process.env.JWT_SECRET!;
const REFRESH_SECRET = process.env.REFRESH_SECRET!;

const ACCESS_EXPIRES_SECONDS = 60 * 60; // 1 hour
const REFRESH_EXPIRES_SECONDS = 60 * 60 * 24 * 30; // 30 days

export const generateAccessToken = (user: any, sessionId: string) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, sessionId },
    ACCESS_SECRET,
    { expiresIn: ACCESS_EXPIRES_SECONDS },
  );
};

export const generateRefreshToken = async (user: any, sessionId: string) => {
  const refreshToken = jwt.sign(
    { sessionId, userId: user.id },
    REFRESH_SECRET,
    { expiresIn: "30d" },
  );

  await redis.set(
    `session:${sessionId}`,
    JSON.stringify({ userId: user.id, role: user.role }),
    "EX",
    REFRESH_EXPIRES_SECONDS,
  );

  return { refreshToken, sessionId };
};

export const rotateRefreshToken = async (oldRefreshToken: string) => {
  let decoded: any;

  try {
    decoded = jwt.verify(oldRefreshToken, REFRESH_SECRET);
  } catch {
    throw new Error("Invalid or expired refresh token. Please log in again.");
  }

  const { sessionId, userId } = decoded;

  const stored = await redis.get(`session:${sessionId}`);
  if (!stored) {
    throw new Error("Session expired. Please log in again.");
  }

  const { pool } = await import("../config/db");
  const result = await pool.query(
    `SELECT id, email, role FROM users WHERE id = $1 AND status = 'active'`,
    [userId],
  );

  if (!result.rows.length) {
    throw new Error("User not found or account disabled.");
  }

  const user = result.rows[0];

  // Extend session TTL on activity
  await redis.expire(`session:${sessionId}`, REFRESH_EXPIRES_SECONDS);

  const newAccessToken = generateAccessToken(user, sessionId);
  const { refreshToken: newRefresh } = await generateRefreshToken(
    user,
    sessionId,
  );

  return { accessToken: newAccessToken, refreshToken: newRefresh };
};
