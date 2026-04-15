import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { redis } from "../config/redis";

const ACCESS_SECRET = process.env.JWT_SECRET!;
const REFRESH_SECRET = process.env.REFRESH_SECRET!;

export const generateAccessToken = (user: any) => {
  return jwt.sign(
    { id: user.id, role: user.role },
    ACCESS_SECRET,
    { expiresIn: "15m" }
  );
};

export const generateRefreshToken = async (user: any) => {
  const sessionId = uuidv4();

  const refreshToken = jwt.sign(
    { sessionId, userId: user.id },
    REFRESH_SECRET,
    { expiresIn: "7d" }
  );

  // store session in Redis
  await redis.set(
    `session:${sessionId}`,
    JSON.stringify({ userId: user.id }),
    "EX",
    60 * 60 * 24 * 7 // 7 days
  );

  return refreshToken;
};
