import { pool } from "../../config/db";

import { getIO } from "../../socket";

import { sendPushNotification } from "./push.service";

export type NotificationChannel = "in_app" | "push" | "email" | "sms";

interface CreateNotificationInput {
  userId: string;

  type: string;

  title: string;

  message: string;

  actionUrl?: string;

  metadata?: Record<string, any>;

  channel?: NotificationChannel;
}

//
// CATEGORY SETTINGS
//

const getSettingKey = (
  type: string,
): "orders" | "payments" | "offers" | "general" => {
  if (type.startsWith("order")) {
    return "orders";
  }

  if (type.startsWith("payment")) {
    return "payments";
  }

  if (type.startsWith("offer")) {
    return "offers";
  }

  return "general";
};

//
// CREATE NOTIFICATION
//

export const createNotification = async ({
  userId,
  type,
  title,
  message,
  actionUrl,
  metadata,
  channel = "in_app",
}: CreateNotificationInput) => {
  //
  // SETTINGS
  //

  const settingsResult = await pool.query(
    `SELECT * FROM notification_settings WHERE user_id = $1 LIMIT 1`,
    [userId],
  );

  const settings = settingsResult.rows[0];
  const categoryKey = getSettingKey(type);

  if (settings && settings[categoryKey] === false) {
    return null;
  }

  //
  // INSERT NOTIFICATION
  //

  const result = await pool.query(
    `
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      action_url,
      metadata,
      channel
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
    `,
    [
      userId,
      type,
      title,
      message,
      actionUrl || null,
      metadata ? JSON.stringify(metadata) : "{}",
      channel,
    ],
  );

  const row = result.rows[0];

  const notification = {
    ...row,
    created_at: String(new Date(row.created_at).getTime()),
  };

  //
  // SOCKET DELIVERY
  //

  if (channel === "in_app") {
    try {
      getIO().to(userId).emit("new_notification", notification);
    } catch (error) {
      console.warn("Socket delivery failed (user may be offline):", error);
    }
  }

  //
  // PUSH NOTIFICATIONS
  //

  if (
    (channel === "push" || channel === "in_app") &&
    settings?.push !== false
  ) {
    const tokenResult = await pool.query(
      `SELECT token FROM push_subscriptions WHERE user_id = $1`,
      [userId],
    );

    await Promise.all(
      tokenResult.rows.map(async (row: any) => {
        try {
          await sendPushNotification({
            token: row.token,
            title,
            body: message,
            data: {
              type,
              actionUrl: actionUrl || "",
            },
          });
        } catch (error) {
          console.error("Push notification failed:", error);
        }
      }),
    );
  }

  //
  // EMAIL
  //

  if (channel === "email") {
    console.log(
      `\n[EMAIL NOTIFICATION]\nUSER: ${userId}\nTITLE: ${title}\nMESSAGE: ${message}\n`,
    );
  }

  //
  // SMS
  //

  if (channel === "sms") {
    console.log(
      `\n[SMS NOTIFICATION]\nUSER: ${userId}\nTITLE: ${title}\nMESSAGE: ${message}\n`,
    );
  }

  return notification;
};

//
// GET UNREAD COUNT
//

export const getUnreadCount = async (userId: string) => {
  const result = await pool.query(
    `
        SELECT COUNT(*)
        FROM notifications
        WHERE user_id = $1
        AND read = false
        `,
    [userId],
  );

  return Number(result.rows[0].count);
};

//
// GET NOTIFICATIONS
//

export const getMyNotifications = async (
  userId: string,
  limit = 20,
  offset = 0,
) => {
  const result = await pool.query(
    `
    SELECT *
    FROM notifications
    WHERE user_id = $1
    AND title != 'Welcome back 👋'
    ORDER BY created_at DESC
    LIMIT $2
    OFFSET $3
    `,
    [userId, limit, offset],
  );

  return result.rows.map((row) => ({
    ...row,
    // Always serialize as millisecond string so frontend can Number() it reliably
    created_at: String(new Date(row.created_at).getTime()),
  }));
};

//
// MARK SINGLE AS READ
//

export const markNotificationAsRead = async (
  notificationId: string,
  userId: string,
) => {
  await pool.query(
    `
      UPDATE notifications
      SET read = true
      WHERE id = $1
      AND user_id = $2
      `,
    [notificationId, userId],
  );

  return true;
};

//
// MARK ALL AS READ
//

export const markAllNotificationsAsRead = async (userId: string) => {
  await pool.query(
    `
      UPDATE notifications
      SET read = true
      WHERE user_id = $1
      `,
    [userId],
  );

  return true;
};

//
// REGISTER PUSH TOKEN
//

export const registerPushToken = async ({
  userId,
  token,
  device,
}: {
  userId: string;

  token: string;

  device?: string;
}) => {
  await pool.query(
    `
      INSERT INTO push_subscriptions (
        user_id,
        token,
        device
      )
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, token)
      DO NOTHING
      `,
    [userId, token, device || "web"],
  );

  return true;
};
