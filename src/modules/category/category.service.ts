import { pool } from "../../config/db";

export const getAllCategories = async () => {
  const result = await pool.query(`
    SELECT
      id,
      name,
      icon
    FROM categories
    ORDER BY created_at ASC
  `);

  return result.rows;
};
