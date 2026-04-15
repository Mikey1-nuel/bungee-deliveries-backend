import { redis } from "../../config/redis";

export const getUserSessions = async (userId: string) => {
  const sessionIds = await redis.lrange(`user_sessions:${userId}`, 0, -1);

  const sessions = await Promise.all(
    sessionIds.map(async (id) => {
      const data = await redis.get(`session:${id}`);
      return { sessionId: id, ...JSON.parse(data!) };
    })
  );

  return sessions;
};
