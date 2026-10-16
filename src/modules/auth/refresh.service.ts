import jwt from "jsonwebtoken";

import { redis } from "../../config/redis";

import { generateAccessToken } from "../../utils/tokens";

import { pool } from "../../config/db";

const REFRESH_SECRET = process.env.REFRESH_SECRET!;

export const refreshAccessToken = async (token: string) => {
  try {
    const payload: any = jwt.verify(token, REFRESH_SECRET);

    /**
     * Verify session still exists
     */
    const session = await redis.get(`session:${payload.sessionId}`);

    if (!session) {
      throw new Error("Session expired");
    }

    const { userId } = JSON.parse(session);

    /**
     * Get latest user data
     */
    const result = await pool.query(
      `
      SELECT id, email, role
      FROM users
      WHERE id = $1
      `,
      [userId],
    );

    const user = result.rows[0];

    if (!user) {
      throw new Error("User not found");
    }

    /**
     * Generate new access token
     */
    return generateAccessToken(user, payload.sessionId);
  } catch (err) {
    console.error("REFRESH TOKEN ERROR:", err);

    throw new Error("Invalid refresh token");
  }
};
