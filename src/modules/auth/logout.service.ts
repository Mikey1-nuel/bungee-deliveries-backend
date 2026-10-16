// // modules/auth/logout.service.ts

// import { redis } from "../../config/redis";

// export const logout = async (sessionId: string, userId: string) => {
//   await redis.del(`session:${sessionId}`);

//   // remove from user's session list
//   const sessions = await redis.lrange(`user_sessions:${userId}`, 0, -1);
//   const updated = sessions.filter((s) => s !== sessionId);

//   await redis.del(`user_sessions:${userId}`);
//   if (updated.length) {
//     await redis.rpush(`user_sessions:${userId}`, ...updated);
//   }

//   return true;
// };

import { redis } from "../../config/redis";

export const logout = async (
  sessionId: string,
  userId: string,
) => {
  try {
    if (!sessionId) {
      throw new Error("No active session");
    }

    /**
     * Delete session
     */
    await redis.del(`session:${sessionId}`);

    /**
     * Remove from user sessions list
     */
    await redis.lrem(
      `user_sessions:${userId}`,
      0,
      sessionId,
    );

    return true;
  } catch (err) {
    console.error("LOGOUT ERROR:", err);

    throw new Error("Logout failed");
  }
};
