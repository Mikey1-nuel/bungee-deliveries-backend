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
  logisticsCompanyId?: string;
  companyName?: string;
  companyPhone?: string;
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

  let transactionOpen = false;

  try {
    await client.query("BEGIN");
    transactionOpen = true;

    const {
      fullName,
      email,
      phone,
      password,
      role,
      restaurantName,
      restaurantLocation,
      restaurantImage,
      logisticsCompanyId,
      companyName,
      companyPhone,
    } = input;

    // 1. Validate required common fields
    if (!fullName?.trim()) {
      throw new GraphQLError("Full name is required.", {
        extensions: { code: "FULL_NAME_REQUIRED" },
      });
    }

    if (!email?.trim()) {
      throw new GraphQLError("Email is required.", {
        extensions: { code: "EMAIL_REQUIRED" },
      });
    }

    if (!phone?.trim()) {
      throw new GraphQLError("Phone number is required.", {
        extensions: { code: "PHONE_REQUIRED" },
      });
    }

    if (!password || password.length < 8) {
      throw new GraphQLError("Password must be at least 8 characters long.", {
        extensions: { code: "INVALID_PASSWORD" },
      });
    }

    // 2. Resolve the requested role
    const finalRole = allowedSignupRoles.includes(role) ? role : "customer";

    // 3. Validate role-specific fields
    if (finalRole === "restaurant" && !restaurantName?.trim()) {
      throw new GraphQLError("Restaurant name is required to sign up.", {
        extensions: { code: "RESTAURANT_NAME_REQUIRED" },
      });
    }

    if (
      finalRole === "logistics" &&
      !companyName?.trim() &&
      !fullName?.trim()
    ) {
      throw new GraphQLError("Logistics company name is required.", {
        extensions: { code: "COMPANY_NAME_REQUIRED" },
      });
    }

    if (finalRole === "rider" && logisticsCompanyId) {
      // Confirm the referenced logistics company exists.
      const companyResult = await client.query(
        `SELECT id FROM logistics_companies WHERE id = $1`,
        [logisticsCompanyId],
      );

      if (companyResult.rowCount === 0) {
        throw new GraphQLError(
          "The selected logistics company does not exist.",
          { extensions: { code: "LOGISTICS_COMPANY_NOT_FOUND" } },
        );
      }
    }

    // 4. Check for an existing account
    const existingUser = await client.query(
      `SELECT id FROM users WHERE email = $1 OR phone = $2 LIMIT 1`,
      [email.trim(), phone.trim()],
    );

    if (existingUser.rowCount && existingUser.rowCount > 0) {
      throw new GraphQLError(
        "An account with this email or phone number already exists.",
        { extensions: { code: "USER_ALREADY_EXISTS" } },
      );
    }

    // 5. Determine approval status and hash password
    const approvalStatus = getApprovalStatus(finalRole);
    const hashedPassword = await bcrypt.hash(password, 12);

    // 6. Create the user
    const userResult = await client.query(
      `
      INSERT INTO users (
        full_name,
        email,
        phone,
        password,
        role,
        approval_status
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING
        id,
        full_name,
        email,
        phone,
        role,
        approval_status
      `,
      [
        fullName.trim(),
        email.trim().toLowerCase(),
        phone.trim(),
        hashedPassword,
        finalRole,
        approvalStatus,
      ],
    );

    const user = userResult.rows[0];

    // 7. Create the restaurant profile when applicable
    if (finalRole === "restaurant") {
      await client.query(
        `
        INSERT INTO restaurants (
          name,
          location,
          image,
          owner_id
        )
        VALUES ($1, $2, $3, $4)
        `,
        [
          restaurantName.trim(),
          restaurantLocation?.trim() || null,
          restaurantImage?.trim() || null,
          user.id,
        ],
      );
    }

    // 8. Create the rider profile when applicable
    if (finalRole === "rider") {
      await client.query(
        `
        INSERT INTO riders (
          user_id,
          logistics_company_id,
          is_available
        )
        VALUES ($1, $2, $3)
        `,
        [user.id, logisticsCompanyId ?? null, false],
      );
    }

    // 9. Create the logistics company when applicable
    if (finalRole === "logistics") {
      await client.query(
        `
        INSERT INTO logistics_companies (
          id,
          name,
          contact_phone
        )
        VALUES ($1, $2, $3)
        `,
        [
          user.id,
          companyName?.trim() || fullName.trim(),
          companyPhone?.trim() || phone.trim(),
        ],
      );
    }

    // 10. Commit all related database writes
    await client.query("COMMIT");
    transactionOpen = false;

    // Notifications are non-critical: failures must not undo signup.
    try {
      await notifyWelcome(user.id);
    } catch (err) {
      console.warn("Welcome notification failed (non-fatal):", err);
    }

    // Pending accounts are successfully created but cannot log in yet.
    if (approvalStatus === "pending") {
      throw new GraphQLError(
        "Your account has been created and is awaiting admin approval. You'll be notified once it's approved.",
        { extensions: { code: "ACCOUNT_PENDING" } },
      );
    }

    // 11. Create the authenticated session for approved accounts
    const sessionId = uuidv4();
    const accessToken = generateAccessToken(user, sessionId);
    const refresh = await generateRefreshToken(user, sessionId);

    await createSession(user, req, sessionId);

    // 12. Return the public user fields and tokens
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
  } catch (err: unknown) {
    if (transactionOpen) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("SIGNUP ROLLBACK ERROR:", rollbackError);
      }
    }

    console.error("SIGNUP ERROR:", err);

    if (err instanceof GraphQLError) {
      throw err;
    }

    if (err instanceof Error) {
      throw new Error(err.message || "Signup failed");
    }

    throw new Error("Signup failed");
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
