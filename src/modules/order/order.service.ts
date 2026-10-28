import { pool } from "../../config/db";

import {
  ORDER_TRANSITIONS,
  CUSTOMER_ALLOWED_STATUSES,
  RESTAURANT_ALLOWED_STATUSES,
  RIDER_ALLOWED_STATUSES,
  ADMIN_ALLOWED_STATUSES,
  OrderStatus,
} from "./order.constants";
import {
  notifyOrderAccepted,
  notifyOrderPreparing,
  notifyOrderReady,
  notifyOrderPickedUp,
  notifyOrderDelivered,
  notifyOrderCancelled,
  notifyOrderRejected,
  notifyOrderCreated,
} from "../notification/notification.engine";

interface AuthUser {
  id: string;
  role: string;
}

interface GetRestaurantOrdersInput {
  user: AuthUser;

  page?: number;

  limit?: number;

  search?: string;

  status?: string;
}

// interface CreateOrderItemInput {
//   restaurant_menu_id: string;
//   quantity: number;
// }

// interface CreateOrderInput {
//   restaurant_id: string;
//   delivery_address: string;
//   items: CreateOrderItemInput[];
// }

export interface CreateOrderItemInput {
  restaurant_menu_id: string;
  quantity: number;
}

interface CreateOrderInput {
  restaurant_id: string;
  delivery_address: string;
  items: CreateOrderItemInput[];
}

interface ValidatedOrderItem {
  restaurant_menu_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  menu_name: string;
  menu_type: string;
  menu_image: string | null;
}

//
// GET SINGLE ORDER
//

export const getOrderById = async (orderId: string) => {
  const result = await pool.query(
    `
    SELECT
      o.id,
      o.status,
      o.total,
      o.delivery_address,
      o.created_at,
      o.user_id,

      o.accepted_at,
      o.prepared_at,
      o.ready_at,
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

      CASE
        WHEN p.id IS NULL THEN NULL
        ELSE json_build_object(
          'id', p.id,
          'amount', p.amount,
          'status', p.status,
          'method', p.method,
          'created_at', p.created_at
        )
      END AS payment,

      CASE
        WHEN rd.id IS NULL THEN NULL
        ELSE json_build_object(
          'id', rd.id,
          'fullName', ru.full_name,
          'phone', ru.phone
        )
      END AS rider,

      CASE
        WHEN lc.id IS NULL THEN NULL
        ELSE json_build_object(
          'id', lc.id,
          'name', lc.name,
          'contact_phone', lc.contact_phone
        )
      END AS "logisticsCompany",

      COALESCE(
        json_agg(
          DISTINCT jsonb_build_object(
            'id', oi.id,
            'restaurant_menu_id', oi.restaurant_menu_id,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'total_price', oi.total_price,
            'menu_name', oi.menu_name,
            'menu_type', oi.menu_type,
            'menu_image', oi.menu_image,
            'menu', json_build_object(
              'id', oi.restaurant_menu_id,
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

    LEFT JOIN payments p
      ON p.order_id = o.id

    LEFT JOIN riders rd
      ON rd.id = o.rider_id

    LEFT JOIN users ru
      ON ru.id = rd.user_id

    LEFT JOIN logistics_companies lc
      ON lc.id = o.logistics_company_id

    WHERE o.id = $1

    GROUP BY
      o.id,
      r.id,
      u.id,
      p.id,
      rd.id,
      ru.id,
      lc.id

    LIMIT 1
    `,
    [orderId],
  );

  if (!result.rows.length) {
    throw new Error("Order not found");
  }

  const order = result.rows[0];

  return {
    ...order,
    total: Number(order.total),
    items: order.items.map((item: any) => ({
      ...item,
      unit_price: Number(item.unit_price),
      total_price: Number(item.total_price),
    })),
  };
};

/**
 * Creates ONE order for ONE restaurant.
 *
 * This function expects the transaction to already be open.
 */
export const createSingleOrder = async (
  client: any,
  input: CreateOrderInput,
  user: AuthUser,
) => {
  const { restaurant_id, delivery_address, items } = input;

  if (!restaurant_id) {
    throw new Error("Restaurant is required");
  }

  if (!delivery_address?.trim()) {
    throw new Error("Delivery address is required");
  }

  if (!items?.length) {
    throw new Error("Order items are required");
  }

  let total = 0;

  const validatedItems: ValidatedOrderItem[] = [];

  for (const item of items) {
    if (!item.restaurant_menu_id) {
      throw new Error("Restaurant menu ID is required");
    }

    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new Error("Each item quantity must be a positive integer");
    }

    const menuResult = await client.query(
      `
      SELECT
        rm.id,
        rm.base_price,
        rm.restaurant_id,
        rm.is_available,

        m.name,
        m.image,
        m.type

      FROM restaurant_menus rm

      INNER JOIN menus m
        ON rm.menu_id = m.id

      WHERE rm.id = $1

      LIMIT 1
      `,
      [item.restaurant_menu_id],
    );

    if (!menuResult.rows.length) {
      throw new Error(`Restaurant menu ${item.restaurant_menu_id} not found`);
    }

    const menu = menuResult.rows[0];

    //
    // IMPORTANT:
    // Never trust the restaurant ID sent by the client.
    // Verify that the menu actually belongs to it.
    //

    if (menu.restaurant_id !== restaurant_id) {
      throw new Error(
        "One or more items do not belong to the selected restaurant",
      );
    }

    if (!menu.is_available) {
      throw new Error(`"${menu.name}" is currently unavailable`);
    }

    const unitPrice = Number(menu.base_price);

    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error(`Invalid price for menu "${menu.name}"`);
    }

    const totalPrice = unitPrice * item.quantity;

    total += totalPrice;

    validatedItems.push({
      restaurant_menu_id: item.restaurant_menu_id,
      quantity: item.quantity,
      unit_price: unitPrice,
      total_price: totalPrice,
      menu_name: menu.name,
      menu_type: menu.type,
      menu_image: menu.image,
    });
  }

  //
  // Create the order
  //

  const orderResult = await client.query(
    `
    INSERT INTO orders (
      user_id,
      restaurant_id,
      total,
      delivery_address,
      status,
      created_at
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      'pending',
      NOW()
    )
    RETURNING *
    `,
    [user.id, restaurant_id, total, delivery_address.trim()],
  );

  const order = orderResult.rows[0];

  //
  // Create order items
  //

  for (const item of validatedItems) {
    await client.query(
      `
      INSERT INTO order_items (
        order_id,
        restaurant_menu_id,
        menu_name,
        menu_type,
        unit_price,
        quantity,
        total_price,
        menu_image
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8
      )
      `,
      [
        order.id,
        item.restaurant_menu_id,
        item.menu_name,
        item.menu_type,
        item.unit_price,
        item.quantity,
        item.total_price,
        item.menu_image,
      ],
    );
  }

  return {
    order,
    validatedItems,
    total,
  };
};

//
// CREATE ORDER
//

// export const createOrder = async (input: CreateOrderInput, user: AuthUser) => {
//   const client = await pool.connect();

//   try {
//     await client.query("BEGIN");

//     if (user.role !== "customer") {
//       throw new Error("Only customers can create orders");
//     }

//     const { restaurant_id, delivery_address, items } = input;

//     if (!items.length) {
//       throw new Error("Order items are required");
//     }

//     let total = 0;

//     const validatedItems: any[] = [];

//     for (const item of items) {
//       const menuResult = await client.query(
//         `
//         SELECT
//           rm.id,
//           rm.base_price,
//           rm.restaurant_id,
//           rm.is_available,

//           m.name,
//           m.image,
//           m.type

//         FROM restaurant_menus rm

//         JOIN menus m
//           ON rm.menu_id = m.id

//         WHERE rm.id = $1

//         LIMIT 1
//         `,
//         [item.restaurant_menu_id],
//       );

//       if (!menuResult.rows.length) {
//         throw new Error("Restaurant menu not found");
//       }

//       const menu = menuResult.rows[0];

//       if (!menu.is_available) {
//         throw new Error("One or more menu items unavailable");
//       }

//       if (menu.restaurant_id !== restaurant_id) {
//         throw new Error("Items must belong to same restaurant");
//       }

//       const unit_price = Number(menu.base_price);
//       const total_price = unit_price * item.quantity;

//       total += total_price;

//       validatedItems.push({
//         restaurant_menu_id: item.restaurant_menu_id,
//         quantity: item.quantity,
//         unit_price,
//         total_price,
//         menu_name: menu.name,
//         menu_type: menu.type,
//         menu_image: menu.image,
//       });
//     }

//     const orderResult = await client.query(
//       `
//       INSERT INTO orders (
//         user_id,
//         restaurant_id,
//         total,
//         delivery_address,
//         status,
//         created_at
//       )
//       VALUES (
//         $1,
//         $2,
//         $3,
//         $4,
//         'pending',
//         NOW()
//       )
//       RETURNING *
//       `,
//       [user.id, restaurant_id, total, delivery_address],
//     );

//     const order = orderResult.rows[0];

//     for (const item of validatedItems) {
//       await client.query(
//         `
//         INSERT INTO order_items (
//           order_id,
//           restaurant_menu_id,
//           menu_name,
//           menu_type,
//           unit_price,
//           quantity,
//           total_price,
//           menu_image
//         )
//         VALUES (
//           $1,
//           $2,
//           $3,
//           $4,
//           $5,
//           $6,
//           $7,
//           $8
//         )
//         `,
//         [
//           order.id,
//           item.restaurant_menu_id,
//           item.menu_name,
//           item.menu_type,
//           item.unit_price,
//           item.quantity,
//           item.total_price,
//           item.menu_image,
//         ],
//       );
//     }

//     await client.query("COMMIT");

//     // Fetch the full order with all joins (customer, restaurant, items)
//     const createdOrder = await getOrderById(order.id);

//     // Look up the restaurant owner to notify them of the new order
//     const ownerResult = await pool.query(
//       `SELECT owner_id FROM restaurants WHERE id = $1 LIMIT 1`,
//       [restaurant_id],
//     );

//     if (ownerResult.rows.length) {
//       await notifyOrderCreated(createdOrder, ownerResult.rows[0].owner_id);
//     }

//     return createdOrder;
//   } catch (error: any) {
//     await client.query("ROLLBACK");

//     throw new Error(error.message || "Failed to create order");
//   } finally {
//     client.release();
//   }
// };

export const createOrder = async (input: CreateOrderInput, user: AuthUser) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    if (user.role !== "customer") {
      throw new Error("Only customers can create orders");
    }

    const { restaurant_id, delivery_address, items } = input;

    //
    // Create one restaurant order
    //

    const { order } = await createSingleOrder(
      client,
      {
        restaurant_id,
        delivery_address,
        items,
      },
      user,
    );

    await client.query("COMMIT");

    //
    // Fetch complete order after commit
    //

    const createdOrder = await getOrderById(order.id);

    //
    // Notify restaurant owner
    //

    const ownerResult = await pool.query(
      `
      SELECT owner_id
      FROM restaurants
      WHERE id = $1
      LIMIT 1
      `,
      [restaurant_id],
    );

    if (ownerResult.rows.length) {
      await notifyOrderCreated(createdOrder, ownerResult.rows[0].owner_id);
    }

    return createdOrder;
  } catch (error: any) {
    await client.query("ROLLBACK");

    throw new Error(error.message || "Failed to create order");
  } finally {
    client.release();
  }
};

//
// GET MY ORDERS
//

export const getMyOrders = async (user: AuthUser) => {
  const result = await pool.query(
    `
    SELECT id
    FROM orders
    WHERE user_id = $1
    ORDER BY created_at DESC
    `,
    [user.id],
  );

  return Promise.all(result.rows.map((row: any) => getOrderById(row.id)));
};

//
// GET RESTAURANT ORDERS
//

export const getRestaurantOrders = async ({
  user,
  page = 1,
  limit = 20,
  search,
  status,
}: GetRestaurantOrdersInput) => {
  const restaurantResult = await pool.query(
    `
    SELECT id
    FROM restaurants
    WHERE owner_id = $1
    LIMIT 1
    `,
    [user.id],
  );

  if (!restaurantResult.rows.length) {
    throw new Error("Restaurant not found");
  }

  const restaurantId = restaurantResult.rows[0].id;

  const offset = (page - 1) * limit;

  //
  // TOTAL COUNT
  //

  const countResult = await pool.query(
    `
    SELECT COUNT(*)::int AS total
    FROM orders o

    JOIN users u
      ON u.id = o.user_id

    WHERE o.restaurant_id = $1

    AND (
      $2::text IS NULL
      OR o.status = $2
    )

    AND (
      $3::text IS NULL
      OR u.full_name ILIKE '%' || $3 || '%'
      OR o.id::text ILIKE '%' || $3 || '%'
    )
    `,
    [restaurantId, status ?? null, search ?? null],
  );

  const total = countResult.rows[0].total;

  //
  // ORDERS QUERY
  //

  const result = await pool.query(
    `
    SELECT
      o.id,
      o.status,
      o.total,
      o.delivery_address,
      o.created_at,

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

            'restaurant_menu_id',
            oi.restaurant_menu_id,

            'quantity',
            oi.quantity,

            'unit_price',
            oi.unit_price,

            'total_price',
            oi.total_price,

            'menu_name', oi.menu_name,
            'menu_type', oi.menu_type,
            'menu_image', oi.menu_image,
            'menu', json_build_object(
              'id', oi.restaurant_menu_id,
              'name', oi.menu_name,
              'image', oi.menu_image,
              'type', oi.menu_type
            )
          )
        ) FILTER (
          WHERE oi.id IS NOT NULL
        ),
        '[]'
      ) AS items

    FROM orders o

    JOIN restaurants r
      ON r.id = o.restaurant_id

    JOIN users u
      ON u.id = o.user_id

    LEFT JOIN order_items oi
      ON oi.order_id = o.id

    LEFT JOIN restaurant_menus rm
      ON rm.id = oi.restaurant_menu_id

    LEFT JOIN menus m
      ON m.id = rm.menu_id

    WHERE o.restaurant_id = $1

    AND (
      $2::text IS NULL
      OR o.status = $2
    )

    AND (
      $3::text IS NULL
      OR u.full_name ILIKE '%' || $3 || '%'
      OR o.id::text ILIKE '%' || $3 || '%'
    )

    GROUP BY
      o.id,
      r.id,
      u.id

    ORDER BY o.created_at DESC

    LIMIT $4
    OFFSET $5
    `,
    [restaurantId, status ?? null, search ?? null, limit, offset],
  );

  const formattedOrders = result.rows.map((order) => ({
    ...order,

    total: Number(order.total),

    items: order.items.map((item: any) => ({
      ...item,

      unit_price: Number(item.unit_price),

      total_price: Number(item.total_price),
    })),
  }));

  return {
    orders: formattedOrders,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};

export const getRestaurantOrderStats = async (user: AuthUser) => {
  const restaurantResult = await pool.query(
    `SELECT id FROM restaurants WHERE owner_id = $1 LIMIT 1`,
    [user.id],
  );

  if (!restaurantResult.rows.length) {
    throw new Error("Restaurant not found");
  }

  const restaurantId = restaurantResult.rows[0].id;

  const result = await pool.query(
    `
    SELECT
      COUNT(*) FILTER (WHERE status = 'pending')                                      AS pending,
      COUNT(*) FILTER (WHERE status = 'accepted')                                     AS accepted,
      COUNT(*) FILTER (WHERE status = 'preparing')                                    AS preparing,
      COUNT(*) FILTER (WHERE status = 'ready_for_pickup')                             AS ready_for_pickup,
      COUNT(*) FILTER (WHERE status = 'picked_up')                                    AS picked_up,
      COUNT(*) FILTER (WHERE status = 'delivered' AND delivered_at::date = NOW()::date) AS delivered_today,
      COALESCE(
        SUM(total) FILTER (WHERE status = 'delivered' AND delivered_at::date = NOW()::date),
        0
      )                                                                                AS revenue_today
    FROM orders
    WHERE restaurant_id = $1
    `,
    [restaurantId],
  );

  const row = result.rows[0];

  return {
    pending: Number(row.pending),
    accepted: Number(row.accepted),
    preparing: Number(row.preparing),
    readyForPickup: Number(row.ready_for_pickup),
    pickedUp: Number(row.picked_up),
    deliveredToday: Number(row.delivered_today),
    revenueToday: Number(row.revenue_today),
  };
};

//
// UPDATE ORDER STATUS
//

export const updateOrderStatus = async (
  orderId: string,
  status: OrderStatus,
  user: AuthUser,
) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const order = await getOrderById(orderId);

    const allowedTransitions =
      ORDER_TRANSITIONS[order.status as keyof typeof ORDER_TRANSITIONS];

    if (!allowedTransitions.includes(status)) {
      throw new Error(`Cannot move order from ${order.status} to ${status}`);
    }

    //
    // CUSTOMER
    //

    if (user.role === "customer") {
      if (!CUSTOMER_ALLOWED_STATUSES.includes(status)) {
        throw new Error("Unauthorized");
      }

      if (order.customer.id !== user.id) {
        throw new Error("Unauthorized");
      }

      if (order.status !== "pending") {
        throw new Error("Order can no longer be cancelled");
      }
    }

    //
    // RESTAURANT
    //

    if (user.role === "restaurant") {
      if (!RESTAURANT_ALLOWED_STATUSES.includes(status)) {
        throw new Error("Unauthorized");
      }

      const restaurantResult = await client.query(
        `
        SELECT id
        FROM restaurants
        WHERE owner_id = $1
        LIMIT 1
        `,
        [user.id],
      );

      if (!restaurantResult.rows.length) {
        throw new Error("Restaurant not found");
      }

      const restaurantId = restaurantResult.rows[0].id;

      if (restaurantId !== order.restaurant.id) {
        throw new Error("Unauthorized");
      }
    }

    //
    // RIDER
    //

    if (user.role === "rider") {
      if (!RIDER_ALLOWED_STATUSES.includes(status)) {
        throw new Error("Unauthorized");
      }
    }

    //
    // ADMIN — full control over all statuses and all orders
    //

    if (user.role === "admin") {
      if (!ADMIN_ALLOWED_STATUSES.includes(status)) {
        throw new Error("Invalid status transition");
      }
      // Admin can update any order — no restaurant/ownership check needed
    }

    //
    // ROLE CHECK — reject unknown roles
    //

    if (!["customer", "restaurant", "rider", "admin"].includes(user.role)) {
      throw new Error("Unauthorized");
    }

    let timestampField: string | null = null;

    switch (status) {
      case "accepted":
        timestampField = "accepted_at";
        break;

      case "preparing":
        timestampField = "prepared_at";
        break;

      case "ready_for_pickup":
        timestampField = "ready_at";
        break;

      case "picked_up":
        timestampField = "picked_up_at";
        break;

      case "delivered":
        timestampField = "delivered_at";
        break;
    }

    if (timestampField) {
      await client.query(
        `
        UPDATE orders
        SET
          status = $1,
          ${timestampField} = NOW()
        WHERE id = $2
        `,
        [status, orderId],
      );
    } else {
      await client.query(
        `
        UPDATE orders
        SET status = $1
        WHERE id = $2
        `,
        [status, orderId],
      );
    }

    //
    // STATUS HISTORY
    //

    await client.query(
      `
      INSERT INTO order_status_history (
        order_id,
        status,
        changed_by
      )
      VALUES ($1, $2, $3)
      `,
      [orderId, status, user.id],
    );

    await client.query("COMMIT");

    const updatedOrder = await getOrderById(orderId);

    //
    // NOTIFICATIONS
    //

    switch (status) {
      case "accepted":
        await notifyOrderAccepted(updatedOrder);
        break;

      case "preparing":
        await notifyOrderPreparing(updatedOrder);
        break;

      case "ready_for_pickup":
        await notifyOrderReady(updatedOrder);
        break;

      case "picked_up":
        await notifyOrderPickedUp(updatedOrder);
        break;

      case "delivered":
        await notifyOrderDelivered(updatedOrder);
        break;

      case "cancelled":
        await notifyOrderCancelled(updatedOrder);
        break;

      case "rejected":
        await notifyOrderRejected(updatedOrder);
        break;
    }

    return updatedOrder;
  } catch (error: any) {
    await client.query("ROLLBACK");

    throw new Error(error.message || "Failed to update order");
  } finally {
    client.release();
  }
};
