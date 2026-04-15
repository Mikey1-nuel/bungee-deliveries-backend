import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { pool } from "../../config/db";
import { generateAccessToken, generateRefreshToken } from "../../utils/tokens";
import { createNotification } from "../notification/notification.service";
import { redis } from "../../config/redis";

export const signup = async (args: any, req: any) => {
  const { name, email, password, role } = args;

  const hashedPassword = await bcrypt.hash(password, 10);

  const result = await pool.query(
    `INSERT INTO users (name, email, password, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, role`,
    [name, email, hashedPassword, role || "user"]
  );

  const user = result.rows[0];

  const accessToken = generateAccessToken(user);
  const refreshToken = await generateRefreshToken(user);

  const sessionId = uuidv4();

  const deviceInfo = {
    userAgent: req.headers["user-agent"],
    ip: req.ip,
  };

  await redis.set(
    `session:${sessionId}`,
    JSON.stringify({
      userId: user.id,
      device: deviceInfo,
    }),
    "EX",
    60 * 60 * 24 * 7
  );

  await redis.rpush(`user_sessions:${user.id}`, sessionId);

  return { accessToken, refreshToken, user };
};

export const login = async (args: any, req: any) => {
  const { email, password } = args;

  const result = await pool.query(
    `SELECT * FROM users WHERE email = $1`,
    [email]
  );

  const user = result.rows[0];
  if (!user) throw new Error("User not found");

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) throw new Error("Invalid credentials");

  const accessToken = generateAccessToken(user);
  const refreshToken = await generateRefreshToken(user);

  const sessionId = uuidv4();

  const deviceInfo = {
    userAgent: req.headers["user-agent"],
    ip: req.ip,
  };

  await redis.set(
    `session:${sessionId}`,
    JSON.stringify({
      userId: user.id,
      device: deviceInfo,
    }),
    "EX",
    60 * 60 * 24 * 7
  );

  await redis.rpush(`user_sessions:${user.id}`, sessionId);

  await createNotification({
    userId: user.id,
    type: "general",
    title: "Welcome back 👋",
    message: "You just logged in",
  });

  return {
    accessToken,
    refreshToken,
    sessionId, // 🔥 IMPORTANT (used later for logout)
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
    },
  };
};
