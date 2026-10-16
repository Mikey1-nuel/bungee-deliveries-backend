import jwt from "jsonwebtoken";
import { redis } from "../config/redis";

const ACCESS_SECRET = process.env.JWT_SECRET!;

export const getUserFromToken = async (req: any) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return null;
    }

    if (!authHeader.startsWith("Bearer ")) {
      return null;
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return null;
    }

    const decoded: any = jwt.verify(token, ACCESS_SECRET);

    /**
     * Verify session still exists
     */
    const session = await redis.get(`session:${decoded.sessionId}`);

    if (!session) {
      return null;
    }

    return {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      sessionId: decoded.sessionId,
    };
  } catch (err) {
    console.error("JWT VERIFY ERROR:", err);

    return null;
  }
};
