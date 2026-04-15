import jwt from "jsonwebtoken";
import { redis } from "../../config/redis";
import { generateAccessToken } from "../../utils/tokens";

const REFRESH_SECRET = process.env.REFRESH_SECRET!;

export const refreshAccessToken = async (token: string) => {
  const payload: any = jwt.verify(token, REFRESH_SECRET);

  const session = await redis.get(`session:${payload.sessionId}`);
  if (!session) throw new Error("Session expired");

  const { userId } = JSON.parse(session);

  return generateAccessToken({ id: userId });
};
