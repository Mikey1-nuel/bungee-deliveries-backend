import { pool } from "../../config/db";

interface AuthUser {
  id: string;
  role: string;
}

export const getLogisticsCompanyId = async (userId: string) => {
  const result = await pool.query(
    `SELECT id FROM logistics_companies WHERE id = (
      SELECT logistics_company_id FROM riders WHERE user_id = $1 LIMIT 1
    ) LIMIT 1`,
    [userId],
  );
  // Logistics users own the company — look up by owner
  const direct = await pool.query(
    `SELECT id FROM logistics_companies WHERE id = $1 LIMIT 1`,
    [userId],
  );
  return direct.rows[0]?.id ?? null;
};

export const getLogisticsOverview = async (user: AuthUser) => {
  const companyId = user.id;

  const riderResult = await pool.query(
    `
    SELECT
      COUNT(*)::INT                                             AS total_riders,

      COUNT(*) FILTER (
        WHERE u.is_online = TRUE
      )::INT                                                    AS online_riders,

      COUNT(*) FILTER (
        WHERE r.is_available = TRUE
      )::INT                                                    AS available_riders,

      COUNT(*) FILTER (
        WHERE r.is_available = FALSE
      )::INT                                                    AS busy_riders

    FROM riders r
    INNER JOIN users u
      ON u.id = r.user_id

    WHERE r.logistics_company_id = $1
    `,
    [companyId],
  );

  const deliveryResult = await pool.query(
    `
    SELECT
      COUNT(*)::INT AS total_deliveries,

      COUNT(*) FILTER (
        WHERE status = 'ready_for_pickup'
          AND rider_id IS NULL
      )::INT AS pending_assignments

    FROM orders
    WHERE logistics_company_id = $1
    `,
    [companyId],
  );

  const riders = riderResult.rows[0];
  const deliveries = deliveryResult.rows[0];

  return {
    totalRiders: riders.total_riders,
    activeRiders: riders.online_riders, // keeps existing GraphQL field
    onlineRiders: riders.online_riders,
    availableRiders: riders.available_riders,
    busyRiders: riders.busy_riders,
    totalDeliveries: deliveries.total_deliveries,
    pendingAssignments: deliveries.pending_assignments,
  };
};

export const getLogisticsRiders = async (user: AuthUser) => {
  const result = await pool.query(
    `
    SELECT
      r.id,
      r.is_available,
      u.is_online,
      u.last_seen,
      u.full_name,
      u.phone,
      u.email,
      COUNT(o.id) FILTER (WHERE o.status = 'delivered') AS total_deliveries
    FROM riders r
    JOIN users u ON u.id = r.user_id
    LEFT JOIN orders o ON o.rider_id = r.id
    WHERE r.logistics_company_id = $1
    GROUP BY r.id, u.id
    ORDER BY u.full_name ASC
    `,
    [user.id],
  );

  return result.rows.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    email: row.email,
    isAvailable: row.is_available,
    isOnline: row.is_online,
    lastSeen: row.last_seen
      ? new Date(Number(row.last_seen)).toISOString()
      : null,
    totalDeliveries: Number(row.total_deliveries),
  }));
};

export const assignRiderToOrder = async (orderId: string, riderId: string) => {
  await pool.query(`UPDATE orders SET rider_id = $1 WHERE id = $2`, [
    riderId,
    orderId,
  ]);

  const result = await pool.query(
    `SELECT * FROM orders WHERE id = $1 LIMIT 1`,
    [orderId],
  );

  return result.rows[0];
};
