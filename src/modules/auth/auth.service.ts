import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

import { pool } from "../../config/db";
import { redis } from "../../config/redis";

import { generateAccessToken, generateRefreshToken } from "../../utils/tokens";

import { notifyWelcome } from "../notification/notification.engine";
import { GraphQLError } from "graphql";

interface SignupInput {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  role: string;
  restaurantName: string;
  restaurantLocation: string;
  restaurantImage: string;
}

interface LoginInput {
  identifier: string;
  password: string;
}

const allowedSignupRoles = ["customer", "restaurant", "rider", "logistics"];

const getApprovalStatus = (role: string) => {
  switch (role) {
    case "restaurant":
    case "rider":
    case "logistics":
      return "pending";

    default:
      return "approved";
  }
};

const createSession = async (user: any, req: any, sessionId: string) => {
  try {
    await redis.set(
      `session:${sessionId}`,
      JSON.stringify({
        userId: user.id,
        device: {
          userAgent: req.headers["user-agent"],
          ip: req.ip,
        },
      }),
      "EX",
      60 * 60 * 24 * 7,
    );

    await redis.rpush(`user_sessions:${user.id}`, sessionId);
  } catch (err) {
    console.warn("Redis unavailable.");
  }
};

// auth.service.ts
export const signup = async (input: SignupInput, req: any) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const {
      fullName, email, phone, password, role,
      restaurantName, restaurantLocation, restaurantImage,
    } = input;

    const existingUser = await client.query(
      `SELECT id FROM users WHERE email = $1 OR phone = $2`,
      [email, phone],
    );

    if (existingUser.rows.length > 0) {
      throw new Error("User already exists");
    }

    const finalRole = allowedSignupRoles.includes(role) ? role : "customer";

    // Restaurant signups must supply a restaurant name up front
    if (finalRole === "restaurant" && !restaurantName?.trim()) {
      throw new GraphQLError("Restaurant name is required to sign up.", {
        extensions: { code: "RESTAURANT_NAME_REQUIRED" },
      });
    }

    const approvalStatus = getApprovalStatus(finalRole);
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await client.query(
      `
      INSERT INTO users (full_name, email, phone, password, role, approval_status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, full_name, email, phone, role, approval_status
      `,
      [fullName, email, phone, hashedPassword, finalRole, approvalStatus],
    );

    const user = result.rows[0];

    // Create the restaurant row in the same transaction, so a pending
    // owner has something real for the admin to review
    if (finalRole === "restaurant") {
      await client.query(
        `
        INSERT INTO restaurants (name, location, image, owner_id)
        VALUES ($1, $2, $3, $4)
        `,
        [restaurantName.trim(), restaurantLocation ?? null, restaurantImage ?? null, user.id],
      );
    }

    await client.query("COMMIT");

    try {
      await notifyWelcome(user.id);
    } catch (err) {
      console.warn("Welcome notification failed (non-fatal):", err);
    }

    if (approvalStatus === "pending") {
      throw new GraphQLError(
        "Your account has been created and is awaiting admin approval. You'll be notified once it's approved.",
        { extensions: { code: "ACCOUNT_PENDING" } },
      );
    }

    const sessionId = uuidv4();
    const accessToken = generateAccessToken(user, sessionId);
    const refresh = await generateRefreshToken(user, sessionId);
    await createSession(user, req, sessionId);

    return {
      accessToken,
      refreshToken: refresh.refreshToken,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        approvalStatus: user.approval_status,
      },
    };
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("SIGNUP ERROR:", err);

    if (err instanceof GraphQLError) {
      throw err;
    }
    throw new Error(err.message || "Signup failed");
  } finally {
    client.release();
  }
};

export const login = async (args: LoginInput, context: any) => {
  const { identifier, password } = args;

  const { req } = context;

  const result = await pool.query(
    `
      SELECT *
      FROM users
      WHERE email = $1
      OR phone = $1
      `,
    [identifier],
  );

  const user = result.rows[0];

  if (!user) {
    throw new GraphQLError("Incorrect email/phone or password.", {
      extensions: { code: "INVALID_CREDENTIALS" },
    });
  }

  if (user.approval_status === "pending") {
    throw new GraphQLError("Your restaurant account is awaiting approval.", {
      extensions: {
        code: "ACCOUNT_PENDING",
      },
    });
  }

  if (user.approval_status === "rejected") {
    throw new GraphQLError("Your application was rejected. Contact support.", {
      extensions: {
        code: "ACCOUNT_REJECTED",
      },
    });
  }

  if (user.status !== "active") {
    throw new GraphQLError(
      "Your account has been disabled by an administrator.",
      {
        extensions: {
          code: "ACCOUNT_DISABLED",
        },
      },
    );
  }

  const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      throw new GraphQLError("Incorrect email/phone or password.", {
        extensions: {
          code: "INVALID_CREDENTIALS",
        },
      });
    }

  const sessionId = uuidv4();

  const accessToken = generateAccessToken(user, sessionId);

  const refresh = await generateRefreshToken(user, sessionId);

  await createSession(user, req, sessionId);

  return {
    accessToken,
    refreshToken: refresh.refreshToken,

    user: {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      approvalStatus: user.approval_status,
    },
  };
};

export const validateSession = async (user: any) => {
  if (!user) {
    return { authenticated: false, user: null };
  }

  const result = await pool.query(
    `
    SELECT id, full_name, email, phone, role, approval_status, status
    FROM users
    WHERE id = $1
    `,
    [user.id],
  );

  const existingUser = result.rows[0];

  if (
    !existingUser ||
    existingUser.approval_status !== "approved" ||
    existingUser.status !== "active"
  ) {
    return { authenticated: false, user: null };
  }

  return {
    authenticated: true,
    user: {
      id: existingUser.id,
      fullName: existingUser.full_name,
      email: existingUser.email,
      phone: existingUser.phone,
      role: existingUser.role,
    },
  };
};
