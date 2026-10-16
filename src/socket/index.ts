import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { pool } from "../config/db";
import { redis } from "../config/redis";

let io: Server | null = null;

const setUserOnline = async (userId: string) => {
  await pool.query(
    `UPDATE users SET is_online = true, last_seen = NOW() WHERE id = $1`,
    [userId],
  );
};

const setUserOffline = async (userId: string) => {
  await pool.query(
    `UPDATE users SET is_online = false, last_seen = NOW() WHERE id = $1`,
    [userId],
  );
};

// Track active socket count per user to handle multiple tabs
const userSocketCount = new Map<string, number>();

export const initSocket = (httpServer: any) => {
  io = new Server(httpServer, {
    cors: { origin: [ "http://localhost:3000", "https://bungee-deliveries-git-development-mikey1nuels-projects.vercel.app" ], credentials: true },
    pingInterval: 25000, // heartbeat every 25s
    pingTimeout: 60000, // disconnect after 60s no response
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Unauthorized"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

      // Parity with HTTP auth: the session must still exist in Redis
      const session = await redis.get(`session:${decoded.sessionId}`);
      if (!session) return next(new Error("Unauthorized"));

      // The account must actually be allowed to be online right now
      const result = await pool.query(
        `SELECT approval_status, status FROM users WHERE id = $1`,
        [decoded.id],
      );
      const user = result.rows[0];

      if (
        !user ||
        user.approval_status !== "approved" ||
        user.status !== "active"
      ) {
        return next(new Error("Unauthorized"));
      }

      socket.data.user = decoded;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.data.user?.id;
    if (!userId) return;

    // Join personal room
    socket.join(userId);

    // Increment socket count for this user
    const count = (userSocketCount.get(userId) ?? 0) + 1;
    userSocketCount.set(userId, count);

    // Mark online only on first connection (handles multiple tabs)
    if (count === 1) {
      await setUserOnline(userId);
      console.log(`✅ User online: ${userId}`);
    }

    // Heartbeat — keep last_seen fresh while connected
    const heartbeat = setInterval(async () => {
      await pool.query(`UPDATE users SET last_seen = NOW() WHERE id = $1`, [
        userId,
      ]);
    }, 30000);

    socket.on("join", (roomId: string) => socket.join(roomId));

    socket.on("disconnect", async () => {
      clearInterval(heartbeat);

      const remaining = (userSocketCount.get(userId) ?? 1) - 1;

      if (remaining <= 0) {
        userSocketCount.delete(userId);
        await setUserOffline(userId);
        console.log(`❌ User offline: ${userId}`);
      } else {
        userSocketCount.set(userId, remaining);
      }
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
};
