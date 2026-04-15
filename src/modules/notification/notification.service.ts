// modules/notification/notification.service.ts

import { pool } from "../../config/db";

export const createNotification = async ({
  userId,
  type,
  title,
  message,
}: any) => {
  await pool.query(
    `INSERT INTO notifications (user_id, type, title, message)
     VALUES ($1, $2, $3, $4)`,
    [userId, type, title, message]
  );
};