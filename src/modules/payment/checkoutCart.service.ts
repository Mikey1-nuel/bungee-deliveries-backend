import { AuthUser } from "../restaurant/menu.service";
import { CreateOrderItemInput } from "../order/order.service";
import { pool } from "../../config/db";
import { notifyOrderCreated } from "../notification/notification.engine";
import { createSingleOrder, getOrderById } from "../order/order.service";

export interface CheckoutCartInput {
  delivery_address: string;
  items: CreateOrderItemInput[];
}

export const checkoutCart = async (
  input: CheckoutCartInput,
  user: AuthUser,
) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    if (user.role !== "customer") {
      throw new Error(
        "Only customers can checkout",
      );
    }

    const {
      delivery_address,
      items,
    } = input;

    if (!delivery_address?.trim()) {
      throw new Error(
        "Delivery address is required",
      );
    }

    if (!items?.length) {
      throw new Error(
        "Your cart is empty",
      );
    }

    //
    // Validate basic cart input
    //

    for (const item of items) {
      if (!item.restaurant_menu_id) {
        throw new Error(
          "Restaurant menu ID is required",
        );
      }

      if (
        !Number.isInteger(item.quantity) ||
        item.quantity <= 0
      ) {
        throw new Error(
          "Each item quantity must be a positive integer",
        );
      }
    }

    //
    // Determine restaurant for every cart item
    //
    // IMPORTANT:
    // We do NOT trust restaurant_id from the frontend.
    // The database determines which restaurant owns
    // each restaurant_menu_id.
    //

    const restaurantGroups =
      new Map<string, CreateOrderItemInput[]>();

    for (const item of items) {
      const menuResult = await client.query(
        `
        SELECT
          rm.id,
          rm.restaurant_id,
          rm.is_available,
          rm.base_price,
          m.name

        FROM restaurant_menus rm

        INNER JOIN menus m
          ON rm.menu_id = m.id

        WHERE rm.id = $1

        LIMIT 1
        `,
        [item.restaurant_menu_id],
      );

      if (!menuResult.rows.length) {
        throw new Error(
          `Menu ${item.restaurant_menu_id} not found`,
        );
      }

      const menu = menuResult.rows[0];

      if (!menu.is_available) {
        throw new Error(
          `"${menu.name}" is currently unavailable`,
        );
      }

      const restaurantId =
        menu.restaurant_id;

      if (!restaurantGroups.has(restaurantId)) {
        restaurantGroups.set(
          restaurantId,
          [],
        );
      }

      restaurantGroups
        .get(restaurantId)!
        .push(item);
    }

    //
    // Create one order per restaurant
    //

    const createdOrders: any[] = [];

    for (const [
      restaurantId,
      restaurantItems,
    ] of restaurantGroups.entries()) {
      const { order } =
        await createSingleOrder(
          client,
          {
            restaurant_id: restaurantId,
            delivery_address:
              delivery_address.trim(),
            items: restaurantItems,
          },
          user,
        );

      createdOrders.push(order);
    }

    //
    // Commit ALL restaurant orders together
    //

    await client.query("COMMIT");

    //
    // Fetch complete orders
    //

    const fullOrders = [];

    for (const order of createdOrders) {
      const fullOrder =
        await getOrderById(order.id);

      fullOrders.push(fullOrder);
    }

    //
    // Notify each restaurant
    //

    for (const order of fullOrders) {
      const ownerResult =
        await pool.query(
          `
          SELECT owner_id
          FROM restaurants
          WHERE id = $1
          LIMIT 1
          `,
          [order.restaurant.id],
        );

      if (ownerResult.rows.length) {
        await notifyOrderCreated(
          order,
          ownerResult.rows[0].owner_id,
        );
      }
    }

    //
    // Calculate checkout totals
    //

    const subtotal = fullOrders.reduce(
      (sum, order) =>
        sum + Number(order.total),
      0,
    );

    return {
      orders: fullOrders,
      orderCount: fullOrders.length,
      subtotal,
      total: subtotal,
    };
  } catch (error: any) {
    await client.query("ROLLBACK");

    throw new Error(
      error.message ||
        "Failed to checkout cart",
    );
  } finally {
    client.release();
  }
};
