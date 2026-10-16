import { pool } from "../../config/db";
import {
  findUserById,
  updateUserStatus,
  deleteUserById,
  approveRestaurantOwner,
  rejectRestaurantOwner,
} from "../user/user.service";

import { logAction } from "../audit/audit.service";
import bcrypt from "bcryptjs";
import { createNotification } from "../notification/notification.service";
import { NOTIFICATION_TYPES } from "../notification/notification.constants";
import { getIO } from "../../socket";

interface AdminStats {
  totalUsers: number;
  totalRestaurants: number;
  totalOrders: number;
  totalRevenue: number;
  pendingOrders: number;
  deliveredToday: number;
  newUsersToday: number;
}

interface GetAdminUsersArgs {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
}

interface GetAdminRestaurantsArgs {
  page?: number;
  limit?: number;
  search?: string;
  approvalStatus?: string;
}

interface GetAdminOrdersArgs {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

interface GetAdminRidersArgs {
  page?: number;
  limit?: number;
  search?: string;
}

//
// STATS
//

export const getAdminStats = async (): Promise<AdminStats> => {
  const { rows } = await pool.query(`
    SELECT
      (SELECT COUNT(*)::INT FROM users) AS total_users,
      (SELECT COUNT(*)::INT FROM restaurants) AS total_restaurants,
      (SELECT COUNT(*)::INT FROM orders) AS total_orders,
      (
        SELECT COALESCE(SUM(total), 0)
        FROM orders
        WHERE status = 'delivered'
      ) AS total_revenue,
      (
        SELECT COUNT(*)::INT
        FROM orders
        WHERE status = 'pending'
      ) AS pending_orders,
      (
        SELECT COUNT(*)::INT
        FROM orders
        WHERE status = 'delivered'
        AND delivered_at::date = CURRENT_DATE
      ) AS delivered_today,
      (
        SELECT COUNT(*)::INT
        FROM users
        WHERE created_at::date = CURRENT_DATE
      ) AS new_users_today
  `);

  const row = rows[0];

  return {
    totalUsers: Number(row.total_users),
    totalRestaurants: Number(row.total_restaurants),
    totalOrders: Number(row.total_orders),
    totalRevenue: Number(row.total_revenue),
    pendingOrders: Number(row.pending_orders),
    deliveredToday: Number(row.delivered_today),
    newUsersToday: Number(row.new_users_today),
  };
};

//
// USERS
//

export const getAdminUsers = async ({
  page = 1,
  limit = 20,
  search,
  role,
}: GetAdminUsersArgs) => {
  page = Math.max(1, page);
  limit = Math.max(1, Math.min(limit, 100));

  const offset = (page - 1) * limit;

  const countQuery = pool.query(
    `
    SELECT COUNT(*)::INT AS total
    FROM users
    WHERE (
      $1::TEXT IS NULL
      OR full_name ILIKE '%' || $1 || '%'
      OR email ILIKE '%' || $1 || '%'
      OR phone ILIKE '%' || $1 || '%'
    )
    AND (
      $2::TEXT IS NULL
      OR role = $2
    )
    `,
    [search ?? null, role ?? null],
  );

  const usersQuery = pool.query(
    `
    SELECT
      id,
      full_name,
      email,
      phone,
      role,
      status,
      approval_status,
      is_online,
      last_seen,
      created_at
    FROM users
    WHERE (
      $1::TEXT IS NULL
      OR full_name ILIKE '%' || $1 || '%'
      OR email ILIKE '%' || $1 || '%'
      OR phone ILIKE '%' || $1 || '%'
    )
    AND (
      $2::TEXT IS NULL
      OR role = $2
    )
    ORDER BY created_at DESC
    LIMIT $3
    OFFSET $4
    `,
    [search ?? null, role ?? null, limit, offset],
  );

  const [countResult, usersResult] = await Promise.all([
    countQuery,
    usersQuery,
  ]);

  const total = Number(countResult.rows[0].total);

  return {
    users: usersResult.rows.map((row) => ({
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      phone: row.phone,
      role: row.role,
      status: row.status,
      approvalStatus: row.approval_status,
      isOnline: row.is_online,
      lastSeen: row.last_seen
        ? String(new Date(row.last_seen).getTime())
        : null,
      createdAt: String(new Date(row.created_at).getTime()),
    })),

    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPreviousPage: page > 1,
    },
  };
};

//
// RESTAURANTS
//

export const getAdminRestaurants = async ({
  page = 1,
  limit = 20,
  search,
  approvalStatus,
}: GetAdminRestaurantsArgs) => {
  page = Math.max(1, page);
  limit = Math.max(1, Math.min(limit, 100));

  const offset = (page - 1) * limit;

  const countQuery = pool.query(
    `
    SELECT COUNT(*)::INT AS total
    FROM restaurants r
    JOIN users u
      ON u.id = r.owner_id
    WHERE (
      $1::TEXT IS NULL
      OR r.name ILIKE '%' || $1 || '%'
      OR u.full_name ILIKE '%' || $1 || '%'
    )
    AND (
      $2::TEXT IS NULL
      OR u.approval_status = $2
    )
    `,
    [search ?? null, approvalStatus ?? null],
  );

  const restaurantsQuery = pool.query(
    `
    SELECT
      r.id,
      r.name,
      r.location,
      r.image,
      r.rating,
      r.owner_id,
      r.created_at,
      u.full_name AS owner_name,
      u.email AS owner_email,
      u.approval_status AS owner_approval_status
    FROM restaurants r
    JOIN users u
      ON u.id = r.owner_id
    WHERE (
      $1::TEXT IS NULL
      OR r.name ILIKE '%' || $1 || '%'
      OR u.full_name ILIKE '%' || $1 || '%'
    )
    AND (
      $2::TEXT IS NULL
      OR u.approval_status = $2
    )
    ORDER BY r.created_at DESC
    LIMIT $3
    OFFSET $4
    `,
    [search ?? null, approvalStatus ?? null, limit, offset],
  );

  const [countResult, restaurantsResult] = await Promise.all([
    countQuery,
    restaurantsQuery,
  ]);

  const total = Number(countResult.rows[0].total);

  return {
    restaurants: restaurantsResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      location: row.location,
      image: row.image,
      rating: Number(row.rating),
      ownerId: row.owner_id,
      ownerName: row.owner_name,
      ownerEmail: row.owner_email,
      approvalStatus: row.owner_approval_status,
      createdAt: String(new Date(row.created_at).getTime()),
    })),

    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPreviousPage: page > 1,
    },
  };
};

//
// ORDERS
//

export const getAdminOrders = async ({
  page = 1,
  limit = 20,
  search,
  status,
}: GetAdminOrdersArgs) => {
  page = Math.max(1, page);
  limit = Math.max(1, Math.min(limit, 100));

  const offset = (page - 1) * limit;

  const countQuery = pool.query(
    `
    SELECT COUNT(*)::INT AS total
    FROM orders o
    JOIN users u
      ON u.id = o.user_id
    WHERE
      ($1::TEXT IS NULL OR o.status = $1)
      AND (
        $2::TEXT IS NULL
        OR u.full_name ILIKE '%' || $2 || '%'
        OR o.id::TEXT ILIKE '%' || $2 || '%'
      )
    `,
    [status ?? null, search ?? null],
  );

  const ordersQuery = pool.query(
    `
    SELECT
      o.id,
      o.status,
      o.total,
      o.delivery_address,
      o.created_at,

      CASE
    WHEN rd.id IS NULL THEN NULL
    ELSE json_build_object(
      'id', rd.id,
      'fullName', ru.full_name
    )
  END AS rider,

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
            'menu_name', oi.menu_name,
            'menu_type', oi.menu_type,
            'menu_image', oi.menu_image,
            'menu',
              json_build_object(
                'name', oi.menu_name,
                'image', oi.menu_image,
                'type', oi.menu_type
              )
          )
        ) FILTER (WHERE oi.id IS NOT NULL),
        '[]'
      ) AS items

    FROM orders o

    JOIN restaurants r
      ON r.id = o.restaurant_id

    JOIN users u
      ON u.id = o.user_id

    LEFT JOIN order_items oi
      ON oi.order_id = o.id

      LEFT JOIN riders rd ON rd.id = o.rider_id
LEFT JOIN users ru ON ru.id = rd.user_id

    WHERE
      ($1::TEXT IS NULL OR o.status = $1)
      AND (
        $2::TEXT IS NULL
        OR u.full_name ILIKE '%' || $2 || '%'
        OR o.id::TEXT ILIKE '%' || $2 || '%'
      )

    GROUP BY
      o.id,
      r.id,
      u.id,
      rd.id,
      ru.id

    ORDER BY o.created_at DESC

    LIMIT $3
    OFFSET $4
    `,
    [status ?? null, search ?? null, limit, offset],
  );

  const [countResult, ordersResult] = await Promise.all([
    countQuery,
    ordersQuery,
  ]);

  const total = Number(countResult.rows[0].total);

  return {
    // admin.service.ts — getAdminOrders mapper
    orders: ordersResult.rows.map((row) => ({
      id: row.id,
      status: row.status,
      total: Number(row.total),
      deliveryAddress: row.delivery_address,
      createdAt: String(new Date(row.created_at).getTime()), // ← fix
      restaurant: row.restaurant,
      customer: row.customer,
      rider: row.rider,
      items: row.items,
    })),

    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPreviousPage: page > 1,
    },
  };
};

//
// RIDERS
//

export const getAdminRiders = async ({
  page = 1,
  limit = 20,
  search,
}: GetAdminRidersArgs) => {
  page = Math.max(1, page);
  limit = Math.max(1, Math.min(limit, 100));

  const offset = (page - 1) * limit;

  const countQuery = pool.query(
    `
    SELECT COUNT(*)::INT AS total
    FROM riders r
    JOIN users u
      ON u.id = r.user_id
    WHERE (
      $1::TEXT IS NULL
      OR u.full_name ILIKE '%' || $1 || '%'
      OR u.phone ILIKE '%' || $1 || '%'
    )
    `,
    [search ?? null],
  );

  const ridersQuery = pool.query(
    `
  SELECT
    r.id,
    r.is_available,
    u.is_online,           -- ← add this
    u.last_seen,           -- ← add this
    u.full_name,
    u.phone,
    u.email,
    COUNT(o.id)
      FILTER (WHERE o.status = 'delivered')
      AS total_deliveries,
    CASE
      WHEN lc.id IS NULL THEN NULL
      ELSE json_build_object(
        'id', lc.id,
        'name', lc.name,
        'contactPhone', lc.contact_phone
      )
    END AS logistics_company
  FROM riders r
  JOIN users u ON u.id = r.user_id
  LEFT JOIN orders o ON o.rider_id = r.id
  LEFT JOIN logistics_companies lc ON lc.id = r.logistics_company_id
  WHERE (
    $1::TEXT IS NULL
    OR u.full_name ILIKE '%' || $1 || '%'
    OR u.phone    ILIKE '%' || $1 || '%'
  )
  GROUP BY r.id, u.id, lc.id
  ORDER BY u.full_name ASC
  LIMIT $2 OFFSET $3
  `,
    [search ?? null, limit, offset],
  );

  const [countResult, ridersResult] = await Promise.all([
    countQuery,
    ridersQuery,
  ]);

  const total = Number(countResult.rows[0].total);

  return {
    riders: ridersResult.rows.map((row) => ({
      id: row.id,
      fullName: row.full_name,
      phone: row.phone,
      email: row.email,
      isAvailable: row.is_available, // rider's manual availability toggle
      isOnline: row.is_online, // ← actual socket presence
      lastSeen: row.last_seen
        ? new Date(Number(row.last_seen)).toISOString()
        : null,
      totalDeliveries: Number(row.total_deliveries),
      logisticsCompany: row.logistics_company,
    })),

    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPreviousPage: page > 1,
    },
  };
};

//
// USER ACTIONS
//

export const banUser = async (adminId: string, userId: string) => {
  if (adminId === userId) {
    throw new Error("You cannot ban your own account.");
  }

  const target = await findUserById(userId);

  if (!target) {
    throw new Error("User not found.");
  }

  if (target.role === "admin") {
    throw new Error("Another administrator cannot be banned.");
  }

  await updateUserStatus(userId, "suspended");

  await logAction({
    userId: adminId,
    action: "BAN_USER",
    entity: "USER",
    entityId: userId,
  });

  return {
    success: true,
    message: "User suspended successfully.",
  };
};

export const unbanUser = async (adminId: string, userId: string) => {
  const target = await findUserById(userId);

  if (!target) {
    throw new Error("User not found.");
  }

  await updateUserStatus(userId, "active");

  await logAction({
    userId: adminId,
    action: "UNBAN_USER",
    entity: "USER",
    entityId: userId,
  });

  return {
    success: true,
    message: "User activated successfully.",
  };
};

export const deleteUser = async (adminId: string, userId: string) => {
  if (adminId === userId) {
    throw new Error("You cannot delete your own account.");
  }

  const target = await findUserById(userId);

  if (!target) {
    throw new Error("User not found.");
  }

  if (target.role === "admin") {
    throw new Error("Another administrator cannot be deleted.");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await deleteUserById(client, userId);

    await logAction({
      userId: adminId,
      action: "DELETE_USER",
      entity: "USER",
      entityId: userId,
    });

    await client.query("COMMIT");

    return {
      success: true,
      message: "User deleted successfully.",
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

//
// RESTAURANT ACTIONS
//

// approveRestaurant / rejectRestaurant
export const approveRestaurant = async (
  adminId: string,
  restaurantId: string,
) => {
  const ownerId = await approveRestaurantOwner(restaurantId);

  if (!ownerId) {
    throw new Error("Restaurant not found");
  }

  try {
    await logAction({
      userId: adminId,
      action: "APPROVE_RESTAURANT",
      entity: "RESTAURANT",
      entityId: restaurantId,
    });
  } catch (err) {
    console.warn("Audit log failed (non-fatal):", err);
  }

  try {
    await createNotification({
      userId: ownerId,
      type: "account_approved",
      title: "Account Approved ✅",
      message: "Your account has been approved — you can now log in.",
      channel: "in_app",
    });
  } catch (err) {
    console.warn("Approval notification failed (non-fatal):", err);
  }

  return {
    success: true,
    message: "Restaurant approved successfully.",
  };
};

export const rejectRestaurant = async (
  adminId: string,
  restaurantId: string,
) => {
  const ownerId = await rejectRestaurantOwner(restaurantId);

  if (!ownerId) {
    throw new Error("Restaurant not found");
  }

  try {
    await logAction({
      userId: adminId,
      action: "REJECT_RESTAURANT",
      entity: "RESTAURANT",
      entityId: restaurantId,
    });
  } catch (err) {
    console.warn("Audit log failed (non-fatal):", err);
  }

  try {
    await createNotification({
      userId: ownerId,
      type: "account_rejected",
      title: "Account Rejected",
      message:
        "Your restaurant application has been rejected. Please contact support if you need clarification.",
      channel: "in_app",
    });
  } catch (err) {
    console.warn("Rejection notification failed (non-fatal):", err);
  }

  return {
    success: true,
    message: "Restaurant rejected successfully.",
  };
};

//
// CREATE USER (admin can create any role)
//

export const adminCreateUser = async (
  adminId: string,
  input: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
    role: string;
    // restaurant-specific
    restaurantName?: string;
    restaurantLocation?: string;
    // rider-specific
    logisticsCompanyId?: string;
    // logistics-specific
    companyName?: string;
    companyPhone?: string;
  },
) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const hashedPassword = await bcrypt.hash(input.password, 10);

    const userResult = await client.query(
      `
      INSERT INTO users (full_name, email, phone, password, role, status, approval_status)
      VALUES ($1, $2, $3, $4, $5, 'active', 'approved')
      RETURNING *
      `,
      [input.fullName, input.email, input.phone, hashedPassword, input.role],
    );

    const newUser = userResult.rows[0];

    // Create role-specific profile
    if (input.role === "restaurant") {
      await client.query(
        `
        INSERT INTO restaurants (owner_id, name, location)
        VALUES ($1, $2, $3)
        `,
        [
          newUser.id,
          input.restaurantName ?? input.fullName,
          input.restaurantLocation ?? null,
        ],
      );
    }

    if (input.role === "rider") {
      await client.query(
        `
        INSERT INTO riders (user_id, logistics_company_id, is_available)
        VALUES ($1, $2, true)
        `,
        [newUser.id, input.logisticsCompanyId ?? null],
      );
    }

    if (input.role === "logistics") {
      await client.query(
        `
        INSERT INTO logistics_companies (id, name, contact_phone)
        VALUES ($1, $2, $3)
        `,
        [
          newUser.id,
          input.companyName ?? input.fullName,
          input.companyPhone ?? input.phone,
        ],
      );
    }

    await logAction({
      userId: adminId,
      action: "CREATE_USER",
      entity: "USER",
      entityId: newUser.id,
      metadata: { role: input.role },
    });

    await client.query("COMMIT");

    return {
      success: true,
      message: `${input.role} account created successfully.`,
      userId: newUser.id,
    };
  } catch (error: any) {
    await client.query("ROLLBACK");
    if (error.code === "23505") {
      throw new Error("A user with this email or phone already exists.");
    }
    throw error;
  } finally {
    client.release();
  }
};

//
// LOGISTICS COMPANIES
//

export const getAdminLogistics = async ({
  page = 1,
  limit = 20,
  search,
}: {
  page?: number;
  limit?: number;
  search?: string;
}) => {
  page = Math.max(1, page);
  limit = Math.max(1, Math.min(limit, 100));
  const offset = (page - 1) * limit;

  const [countResult, result] = await Promise.all([
    pool.query(
      `
      SELECT COUNT(*)::INT AS total
      FROM logistics_companies lc
      WHERE (
        $1::TEXT IS NULL
        OR lc.name ILIKE '%' || $1 || '%'
        OR lc.contact_phone ILIKE '%' || $1 || '%'
      )
      `,
      [search ?? null],
    ),
    pool.query(
      `
  SELECT
    lc.id,
    lc.name,
    lc.contact_phone,
    lc.created_at,
    COUNT(r.id)::INT                                                    AS total_riders,
    COUNT(r.id) FILTER (WHERE u.is_online = true)::INT                 AS online_riders,
    COUNT(r.id) FILTER (WHERE u.is_online = true AND r.is_available = true)::INT AS available_riders,
    COUNT(r.id) FILTER (
      WHERE u.is_online = true
      AND EXISTS (
        SELECT 1 FROM orders o
        WHERE o.rider_id = r.id
        AND o.status IN ('picked_up', 'ready_for_pickup')
      )
    )::INT AS busy_riders
  FROM logistics_companies lc
  LEFT JOIN riders r ON r.logistics_company_id = lc.id
  LEFT JOIN users u ON u.id = r.user_id
  WHERE (
    $1::TEXT IS NULL
    OR lc.name ILIKE '%' || $1 || '%'
    OR lc.contact_phone ILIKE '%' || $1 || '%'
  )
  GROUP BY lc.id
  ORDER BY lc.created_at DESC
  LIMIT $2 OFFSET $3
  `,
      [search ?? null, limit, offset],
    ),
  ]);

  const total = Number(countResult.rows[0].total);

  // In the mapper:
  return {
    logistics: result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      contactPhone: row.contact_phone,
      createdAt: String(new Date(row.created_at).getTime()),
      totalRiders: row.total_riders,
      onlineRiders: row.online_riders,
      availableRiders: row.available_riders,
      busyRiders: row.busy_riders,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPreviousPage: page > 1,
    },
  };
};

//
// DISPATCH BATCHES
//

type DispatchSlot = "morning" | "afternoon" | "evening";

const DISPATCH_SLOTS: Record<DispatchSlot, string> = {
  morning: "09:00",
  afternoon: "13:00",
  evening: "18:00",
};

export const createDispatchBatch = async (
  adminId: string,
  input: {
    riderId: string;
    orderIds: string[];
    slot: DispatchSlot;
    scheduledDate: string; // YYYY-MM-DD
  },
) => {
  const client = await pool.connect();
  let batch: any;
  let scheduledAt: Date;

  try {
    await client.query("BEGIN");

    const riderCheck = await client.query(
      `SELECT id FROM riders WHERE id = $1`,
      [input.riderId],
    );
    if (!riderCheck.rows.length) throw new Error("Rider not found");

    const slotTime = DISPATCH_SLOTS[input.slot];
    scheduledAt = new Date(`${input.scheduledDate}T${slotTime}:00`);

    const batchResult = await client.query(
      `
      INSERT INTO dispatch_batches (rider_id, slot, scheduled_at, created_by, status)
      VALUES ($1, $2, $3, $4, 'scheduled')
      RETURNING *
      `,
      [input.riderId, input.slot, scheduledAt, adminId],
    );

    batch = batchResult.rows[0];

    for (const orderId of input.orderIds) {
      const duplicateCheck = await client.query(
        `
        SELECT 1
        FROM dispatch_batch_orders dbo
        JOIN dispatch_batches db ON db.id = dbo.batch_id
        WHERE dbo.order_id = $1
        AND db.status IN ('scheduled', 'in_progress')
        LIMIT 1
        `,
        [orderId],
      );

      if (duplicateCheck.rows.length) {
        throw new Error(
          `Order #${orderId.slice(0, 8)} is already assigned to an active dispatch batch.`,
        );
      }

      await client.query(
        `UPDATE orders SET rider_id = $1, assigned_at = NOW() WHERE id = $2`,
        [input.riderId, orderId],
      );

      await client.query(
        `INSERT INTO dispatch_batch_orders (batch_id, order_id) VALUES ($1, $2)`,
        [batch.id, orderId],
      );
    }

    await logAction({
      userId: adminId,
      action: "CREATE_DISPATCH_BATCH",
      entity: "DISPATCH_BATCH",
      entityId: batch.id,
      metadata: { slot: input.slot, orderCount: input.orderIds.length },
    });

    await client.query("COMMIT");
  } catch (error: any) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  //
  // POST-COMMIT: notify the rider. The batch is already saved at this
  // point — a failure here must never be reported as a failed dispatch.
  //
  try {
    const riderUserResult = await pool.query(
      `SELECT user_id FROM riders WHERE id = $1`,
      [input.riderId],
    );

    if (riderUserResult.rows.length) {
      const riderUserId = riderUserResult.rows[0].user_id;

      const slotLabel: Record<DispatchSlot, string> = {
        morning: "Morning (9:00 AM)",
        afternoon: "Afternoon (1:00 PM)",
        evening: "Evening (6:00 PM)",
      };

      await createNotification({
        userId: riderUserId,
        type: NOTIFICATION_TYPES.ORDER_ASSIGNED,
        title: "New Delivery Batch Assigned 🛵",
        message: `You have been assigned ${input.orderIds.length} order${input.orderIds.length > 1 ? "s" : ""} for the ${slotLabel[input.slot]} dispatch on ${input.scheduledDate}.`,
        actionUrl: `/dashboard/rider/batches?highlight=${batch.id}`,
        channel: "in_app",
        metadata: {
          batchId: batch.id,
          slot: input.slot,
          orderCount: input.orderIds.length,
        },
      });
    }
  } catch (err) {
    console.warn("Dispatch notification failed (non-fatal):", err);
  }

  return {
    success: true,
    message: `Dispatch batch created. ${input.orderIds.length} orders assigned to rider for ${input.slot} slot.`,
    batchId: batch.id,
    scheduledAt: scheduledAt.toISOString(),
  };
};

export const getDispatchBatches = async ({
  page = 1,
  limit = 20,
  slot,
  date,
}: {
  page?: number;
  limit?: number;
  slot?: string;
  date?: string;
}) => {
  page = Math.max(1, page);
  const offset = (page - 1) * limit;

  const [countResult, result] = await Promise.all([
    pool.query(
      `
      SELECT COUNT(*)::INT AS total
      FROM dispatch_batches db
      WHERE ($1::TEXT IS NULL OR db.slot = $1)
      AND ($2::DATE IS NULL OR db.scheduled_at::date = $2::date)
      `,
      [slot ?? null, date ?? null],
    ),
    pool.query(
      `
      SELECT
        db.id,
        db.slot,
        db.scheduled_at,
        db.status,
        db.created_at,
        u.full_name AS rider_name,
        u.phone AS rider_phone,
        COUNT(dbo.order_id)::INT AS order_count
      FROM dispatch_batches db
      JOIN riders r ON r.id = db.rider_id
      JOIN users u ON u.id = r.user_id
      LEFT JOIN dispatch_batch_orders dbo ON dbo.batch_id = db.id
      WHERE ($1::TEXT IS NULL OR db.slot = $1)
      AND ($2::DATE IS NULL OR db.scheduled_at::date = $2::date)
      GROUP BY db.id, u.full_name, u.phone
      ORDER BY db.scheduled_at DESC
      LIMIT $3 OFFSET $4
      `,
      [slot ?? null, date ?? null, limit, offset],
    ),
  ]);

  const total = Number(countResult.rows[0].total);

  return {
    batches: result.rows.map((row) => ({
      id: row.id,
      slot: row.slot,
      scheduledAt: String(new Date(row.scheduled_at).getTime()), // ← was raw timestamp
      status: row.status,
      createdAt: String(new Date(row.created_at).getTime()),
      riderName: row.rider_name,
      riderPhone: row.rider_phone,
      orderCount: row.order_count,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPreviousPage: page > 1,
    },
  };
};
