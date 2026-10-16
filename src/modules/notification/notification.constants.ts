export const NOTIFICATION_TYPES = {
  ORDER_CREATED: "order_created",
  ORDER_ACCEPTED: "order_accepted",
  ORDER_REJECTED: "order_rejected",
  ORDER_PREPARING: "order_preparing",
  ORDER_READY: "order_ready",
  ORDER_PICKED_UP: "order_picked_up",
  ORDER_DELIVERED: "order_delivered",
  ORDER_CANCELLED: "order_cancelled",
  ORDER_ASSIGNED: "order_assigned",
  BATCH_ACCEPTED: "batch_accepted", // ← add
  BATCH_REJECTED: "batch_rejected", // ← add
  PAYMENT_SUCCESS: "payment_success",
  GENERAL: "general",
  OFFER: "offer",
} as const;
