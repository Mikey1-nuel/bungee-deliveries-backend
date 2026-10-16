import { pool } from "../../config/db";
import { NOTIFICATION_TYPES } from "../notification/notification.constants";

interface AuthUser {
  id: string;
  role: string;
}

export const getMyRiderProfile = async (user: AuthUser) => {
  const result = await pool.query(
    `
    SELECT
      r.id,
      r.is_available,
      u.full_name,
      u.phone,
      u.email,
      CASE
        WHEN lc.id IS NULL THEN NULL
        ELSE json_build_object(
          'id', lc.id,
          'name', lc.name,
          'contact_phone', lc.contact_phone
        )
      END AS "logisticsCompany"
    FROM riders r
    JOIN users u ON u.id = r.user_id
    LEFT JOIN logistics_companies lc ON lc.id = r.logistics_company_id
    WHERE r.user_id = $1
    LIMIT 1
    `,
    [user.id],
  );

  if (!result.rows.length) throw new Error("Rider profile not found");

  const row = result.rows[0];
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    email: row.email,
    isAvailable: row.is_available,
    logisticsCompany: row.logisticsCompany,
  };
};

export const getMyDeliveries = async (user: AuthUser) => {
  const riderResult = await pool.query(
    `SELECT id FROM riders WHERE user_id = $1 LIMIT 1`,
    [user.id],
  );

  if (!riderResult.rows.length) throw new Error("Rider not found");

  const riderId = riderResult.rows[0].id;

  const result = await pool.query(
    `
    SELECT
      o.id,
      o.status,
      o.total,
      o.delivery_address,
      o.created_at,
      o.picked_up_at,
      o.delivered_at,

      json_build_object(
        'id', r.id,
        'name', r.name,
        'image', r.image,
        'location', r.location
      ) AS restaurant,

      json_build_object(
        'id', u.id,
        'fullName', u.full_name,
        'phone', u.phone,
        'email', u.email
      ) AS customer,

      COALESCE(
        json_agg(
          DISTINCT jsonb_build_object(
            'id', oi.id,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'total_price', oi.total_price,
            'restaurant_menu_id', oi.restaurant_menu_id,
            'menu', json_build_object(
              'name', oi.menu_name,
              'image', oi.menu_image,
              'type', oi.menu_type
            )
          )
        ) FILTER (WHERE oi.id IS NOT NULL),
        '[]'
      ) AS items

    FROM orders o
    JOIN restaurants r ON r.id = o.restaurant_id
    JOIN users u ON u.id = o.user_id
    LEFT JOIN order_items oi ON oi.order_id = o.id
    WHERE o.rider_id = $1
    GROUP BY o.id, r.id, u.id
    ORDER BY o.created_at DESC
    `,
    [riderId],
  );

  return result.rows.map((row) => ({
    ...row,
    total: Number(row.total),
    items: row.items.map((item: any) => ({
      ...item,
      unit_price: Number(item.unit_price),
      total_price: Number(item.total_price),
    })),
  }));
};

export const getMyDispatchBatches = async (user: AuthUser) => {
  const riderResult = await pool.query(
    `SELECT id FROM riders WHERE user_id = $1 LIMIT 1`,
    [user.id],
  );
  if (!riderResult.rows.length) throw new Error("Rider not found");
  const riderId = riderResult.rows[0].id;

  const result = await pool.query(
    `
    SELECT
      db.id,
      db.slot,
      db.status,
      db.scheduled_at,
      db.created_at,
      COUNT(dbo.order_id)::INT AS order_count,
      COALESCE(
        json_agg(
          jsonb_build_object(
            'id', o.id,
            'status', o.status,
            'total', o.total,
            'deliveryAddress', o.delivery_address,
            'restaurant', r.name,
            'customer', u.full_name,
            'items',
            (
              SELECT COALESCE(
                json_agg(
                  jsonb_build_object(
                    'name', oi.menu_name,
                    'type', oi.menu_type,
                    'image', oi.menu_image,
                    'quantity', oi.quantity
                  )
                  ORDER BY oi.created_at
                ),
                '[]'
              )
              FROM order_items oi
              WHERE oi.order_id = o.id
            )
          )
          ORDER BY o.created_at
        )
        FILTER (WHERE o.id IS NOT NULL),
        '[]'
      ) AS orders
    FROM dispatch_batches db
    LEFT JOIN dispatch_batch_orders dbo ON dbo.batch_id = db.id
    LEFT JOIN orders o                  ON o.id = dbo.order_id
    LEFT JOIN restaurants r             ON r.id = o.restaurant_id
    LEFT JOIN users u                   ON u.id = o.user_id
    WHERE db.rider_id = $1
    GROUP BY db.id
    ORDER BY db.scheduled_at DESC
    `,
    [riderId],
  );

  return result.rows.map((row) => ({
    id:          row.id,
    slot:        row.slot,
    status:      row.status,
    scheduledAt: String(new Date(row.scheduled_at).getTime()),
    createdAt:   String(new Date(row.created_at).getTime()),
    orderCount:  row.order_count,
    orders:      row.orders.map((o: any) => ({
      ...o,
      total: Number(o.total),
      items: o.items ?? [],
    })),
  }));
};

export const acceptDispatchBatch = async (user: AuthUser, batchId: string) => {
  // Verify batch belongs to this rider
  const riderResult = await pool.query(
    `SELECT id FROM riders WHERE user_id = $1 LIMIT 1`,
    [user.id],
  );
  if (!riderResult.rows.length) throw new Error("Rider not found");
  const riderId = riderResult.rows[0].id;

  const batchResult = await pool.query(
    `SELECT id, status FROM dispatch_batches WHERE id = $1 AND rider_id = $2`,
    [batchId, riderId],
  );
  if (!batchResult.rows.length) throw new Error("Batch not found");
  if (batchResult.rows[0].status !== "scheduled") {
    throw new Error("Only scheduled batches can be accepted");
  }

  await pool.query(
    `UPDATE dispatch_batches SET status = 'in_progress' WHERE id = $1`,
    [batchId],
  );

  // Notify admin
  const adminResult = await pool.query(
    `
    SELECT db.created_by, u.full_name AS rider_name
    FROM dispatch_batches db
    JOIN riders r ON r.id = db.rider_id
    JOIN users u ON u.id = r.user_id
    WHERE db.id = $1
    `,
    [batchId],
  );

  if (adminResult.rows.length && adminResult.rows[0].created_by) {
    const { createNotification } = await import(
      "../notification/notification.service"
    );
    await createNotification({
      userId:    adminResult.rows[0].created_by,
      type:      NOTIFICATION_TYPES.BATCH_ACCEPTED,
      title:     "Batch Accepted ✅",
      message:   `${adminResult.rows[0].rider_name} accepted the dispatch batch and has started deliveries.`,
      actionUrl: `/dashboard/admin/dispatch?highlight=${batchId}`,
      channel:   "in_app",
      metadata:  { batchId },
    });
  }

  return true;
};

export const rejectDispatchBatch = async (
  user: AuthUser,
  batchId: string,
  reason?: string,
) => {
  const riderResult = await pool.query(
    `SELECT id FROM riders WHERE user_id = $1 LIMIT 1`,
    [user.id],
  );
  if (!riderResult.rows.length) throw new Error("Rider not found");
  const riderId = riderResult.rows[0].id;

  const batchResult = await pool.query(
    `SELECT id, status FROM dispatch_batches WHERE id = $1 AND rider_id = $2`,
    [batchId, riderId],
  );
  if (!batchResult.rows.length) throw new Error("Batch not found");
  if (batchResult.rows[0].status !== "scheduled") {
    throw new Error("Only scheduled batches can be rejected");
  }

  await pool.query(
    `UPDATE dispatch_batches SET status = 'cancelled' WHERE id = $1`,
    [batchId],
  );

  // Unassign rider from all orders in this batch
  await pool.query(
    `
    UPDATE orders SET rider_id = NULL, assigned_at = NULL
    WHERE id IN (
      SELECT order_id FROM dispatch_batch_orders WHERE batch_id = $1
    )
    `,
    [batchId],
  );

  // Notify admin
  const adminResult = await pool.query(
    `
    SELECT db.created_by, u.full_name AS rider_name
    FROM dispatch_batches db
    JOIN riders r ON r.id = db.rider_id
    JOIN users u ON u.id = r.user_id
    WHERE db.id = $1
    `,
    [batchId],
  );

  if (adminResult.rows.length && adminResult.rows[0].created_by) {
    const { createNotification } = await import(
      "../notification/notification.service"
    );
    await createNotification({
      userId:    adminResult.rows[0].created_by,
      type:      NOTIFICATION_TYPES.BATCH_ACCEPTED,
      title:     "Batch Rejected ⚠️",
      message:   `${adminResult.rows[0].rider_name} rejected the dispatch batch.${reason ? ` Reason: ${reason}` : ""} Please reassign the orders.`,
      actionUrl: `/dashboard/admin/dispatch?highlight=${batchId}`,
      channel:   "in_app",
      metadata:  { batchId, reason },
    });
  }

  return true;
};

export const getMyEarnings = async (user: AuthUser) => {
  const riderResult = await pool.query(
    `SELECT id FROM riders WHERE user_id = $1 LIMIT 1`,
    [user.id],
  );

  if (!riderResult.rows.length) throw new Error("Rider not found");

  const riderId = riderResult.rows[0].id;

  const result = await pool.query(
    `
    SELECT
      COUNT(*) FILTER (WHERE status = 'delivered')                                       AS total_deliveries,
      COALESCE(SUM(total) FILTER (WHERE status = 'delivered'), 0)                        AS total_earnings,
      COUNT(*) FILTER (WHERE status = 'delivered' AND delivered_at::date = NOW()::date)  AS today_deliveries,
      COALESCE(SUM(total) FILTER (
        WHERE status = 'delivered' AND delivered_at::date = NOW()::date
      ), 0)                                                                               AS today_earnings
    FROM orders
    WHERE rider_id = $1
    `,
    [riderId],
  );

  const row = result.rows[0];
  return {
    totalDeliveries: Number(row.total_deliveries),
    totalEarnings: Number(row.total_earnings),
    todayDeliveries: Number(row.today_deliveries),
    todayEarnings: Number(row.today_earnings),
  };
};

export const updateRiderAvailability = async (
  user: AuthUser,
  isAvailable: boolean,
) => {
  await pool.query(`UPDATE riders SET is_available = $1 WHERE user_id = $2`, [
    isAvailable,
    user.id,
  ]);
  return true;
};
