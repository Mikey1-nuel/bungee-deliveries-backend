import { pool } from "../../config/db";

export const updateUserStatus = async (userId: string, status: string) => {
  await pool.query(
    `UPDATE users SET status = $1 WHERE id = $2`,
    [status, userId]
  );
};
