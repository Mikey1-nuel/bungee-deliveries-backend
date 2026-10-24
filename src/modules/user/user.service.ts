import { PoolClient } from "pg";
import { pool } from "../../config/db";

export interface User {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  password: string;
  role: string;
  status: string;
  approval_status: string;
  created_at: Date;
}

export const findUserById = async (userId: string): Promise<User | null> => {
  const { rows } = await pool.query(
    `
    SELECT *
    FROM users
    WHERE id = $1
    `,
    [userId],
  );

  return rows[0] ?? null;
};

export const updateUserStatus = async (
  userId: string,
  status: "active" | "suspended" | "disabled",
) => {
  await pool.query(
    `
    UPDATE users
    SET status = $1
    WHERE id = $2
    `,
    [status, userId],
  );
};

export const deleteUserById = async (client: PoolClient, userId: string) => {
  await client.query(
    `
    DELETE FROM users
    WHERE id = $1
    `,
    [userId],
  );
};

// user.service.ts — add these two functions

export const approveUserById = async (userId: string) => {
  const result = await pool.query(
    `
    UPDATE users
    SET approval_status = 'approved'
    WHERE id = $1
      AND approval_status != 'approved'
    RETURNING id, role
    `,
    [userId],
  );

  return result.rows[0] ?? null; // { id, role } or null if not found / already approved
};

export const rejectUserById = async (userId: string) => {
  const result = await pool.query(
    `
    UPDATE users
    SET approval_status = 'rejected'
    WHERE id = $1
      AND approval_status != 'rejected'
    RETURNING id, role
    `,
    [userId],
  );

  return result.rows[0] ?? null;
};

export const approveRestaurantOwner = async (restaurantId: string) => {
  const result = await pool.query(
    `
    UPDATE users
    SET approval_status = 'approved'
    WHERE id = (
        SELECT owner_id
        FROM restaurants
        WHERE id = $1
    )
    RETURNING id
    `,
    [restaurantId],
  );

  return result.rows[0]?.id ?? null;
};

export const rejectRestaurantOwner = async (restaurantId: string) => {
  const result = await pool.query(
    `
    UPDATE users
    SET approval_status = 'rejected'
    WHERE id = (
        SELECT owner_id
        FROM restaurants
        WHERE id = $1
    )
    RETURNING id
    `,
    [restaurantId],
  );

  return result.rows[0]?.id ?? null;
};
