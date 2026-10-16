import { NOTIFICATION_TYPES } from "./notification.constants";
import { createNotification } from "./notification.service";
import { pool } from "../../config/db";

const getUserId = (order: any): string | null => {
  return order.user_id ?? order.customer?.id ?? null;
};

//
// WELCOME — signup only, no login repeat
//

export const notifyWelcome = async (userId: string) => {
  await createNotification({
    userId,
    type: NOTIFICATION_TYPES.GENERAL,
    title: "Welcome to Bungee 🎉",
    message:
      "Your account was created successfully. Start exploring restaurants near you!",
    channel: "in_app",
  });
};

//
// ORDER CREATED — notify customer + restaurant owner
//

export const notifyOrderCreated = async (
  order: any,
  restaurantOwnerId: string,
) => {
  const userId = getUserId(order);

  // Notify customer
  if (userId) {
    await createNotification({
      userId,
      type: NOTIFICATION_TYPES.ORDER_CREATED,
      title: "Order Placed ✅",
      message: `Your order at ${order.restaurant?.name || "the restaurant"} has been placed and is awaiting confirmation.`,
      actionUrl: `/dashboard/orderHistory?highlight=${order.id}`,
      metadata: { orderId: order.id, status: "pending" },
      channel: "in_app",
    });
  }

  // Notify restaurant owner
  await createNotification({
    userId: restaurantOwnerId,
    type: NOTIFICATION_TYPES.ORDER_CREATED,
    title: "New Order Received 🛎️",
    message: `You have a new order from ${order.customer?.fullName || "a customer"}.`,
    actionUrl: `/dashboard/restaurant_dash/orders?highlight=${order.id}`,
    metadata: { orderId: order.id, status: "pending" },
    channel: "in_app",
  });

  // after notifying customer and restaurant owner
  const adminResult = await pool.query(
    `SELECT id FROM users WHERE role = 'admin'`,
  );

  for (const admin of adminResult.rows) {
    await createNotification({
      userId: admin.id,
      type: NOTIFICATION_TYPES.ORDER_CREATED,
      title: "New Order Placed 🛎️",
      message: `A new order was placed at ${order.restaurant?.name || "a restaurant"}.`,
      actionUrl: `/dashboard/admin/orders?highlight=${order.id}`,
      channel: "in_app",
    });
  }
};

//
// ORDER STATUS UPDATES — all notify the customer
//

export const notifyOrderAccepted = async (order: any) => {
  const userId = getUserId(order);
  if (!userId) {
    console.error("notifyOrderAccepted: could not resolve userId", order);
    return;
  }

  await createNotification({
    userId,
    type: NOTIFICATION_TYPES.ORDER_ACCEPTED,
    title: "Order Accepted 👍",
    message: `${order.restaurant?.name || "The restaurant"} accepted your order and will start preparing it soon.`,
    actionUrl: `/dashboard/orderHistory?highlight=${order.id}`,
    metadata: { orderId: order.id, status: "accepted" },
    channel: "in_app",
  });
};

export const notifyOrderRejected = async (order: any) => {
  const userId = getUserId(order);
  if (!userId) return;

  await createNotification({
    userId,
    type: NOTIFICATION_TYPES.ORDER_REJECTED,
    title: "Order Rejected",
    message: `${order.restaurant?.name || "The restaurant"} could not accept your order. Please try again or choose another restaurant.`,
    actionUrl: `/dashboard/orderHistory?highlight=${order.id}`,
    metadata: { orderId: order.id, status: "rejected" },
    channel: "in_app",
  });
};

export const notifyOrderPreparing = async (order: any) => {
  const userId = getUserId(order);
  if (!userId) return;

  await createNotification({
    userId,
    type: NOTIFICATION_TYPES.ORDER_PREPARING,
    title: "Your Food is Being Prepared 👨‍🍳",
    message: `${order.restaurant?.name || "The restaurant"} is now preparing your order.`,
    actionUrl: `/dashboard/orderHistory?highlight=${order.id}`,
    metadata: { orderId: order.id, status: "preparing" },
    channel: "in_app",
  });
};

export const notifyOrderReady = async (order: any) => {
  const userId = getUserId(order);
  if (!userId) return;

  await createNotification({
    userId,
    type: NOTIFICATION_TYPES.ORDER_READY,
    title: "Order Ready for Pickup 📦",
    message: "Your order is packed and waiting for a rider to pick it up.",
    actionUrl: `/dashboard/orderHistory?highlight=${order.id}`,
    metadata: { orderId: order.id, status: "ready_for_pickup" },
    channel: "in_app",
  });
};

export const notifyOrderPickedUp = async (order: any) => {
  const userId = getUserId(order);
  if (!userId) return;

  await createNotification({
    userId,
    type: NOTIFICATION_TYPES.ORDER_PICKED_UP,
    title: "Order On Its Way 🛵",
    message: "Your rider has picked up your order and is heading your way.",
    actionUrl: `/dashboard/orderHistory?highlight=${order.id}`,
    metadata: { orderId: order.id, status: "picked_up" },
    channel: "in_app",
  });
};

export const notifyOrderDelivered = async (order: any) => {
  const userId = getUserId(order);
  if (!userId) return;

  await createNotification({
    userId,
    type: NOTIFICATION_TYPES.ORDER_DELIVERED,
    title: "Order Delivered 🎉",
    message: "Your order has been delivered. Enjoy your meal! 🍔",
    actionUrl: `/dashboard/orderHistory?highlight=${order.id}`,
    metadata: { orderId: order.id, status: "delivered" },
    channel: "in_app",
  });
};

export const notifyOrderCancelled = async (order: any) => {
  const userId = getUserId(order);
  if (!userId) return;

  await createNotification({
    userId,
    type: NOTIFICATION_TYPES.ORDER_CANCELLED,
    title: "Order Cancelled",
    message: "Your order has been cancelled.",
    actionUrl: `/dashboard/orderHistory?highlight=${order.id}`,
    metadata: { orderId: order.id, status: "cancelled" },
    channel: "in_app",
  });
};
