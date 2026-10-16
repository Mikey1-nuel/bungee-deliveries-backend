export const ORDER_STATUSES = [
  "pending",
  "accepted",
  "preparing",
  "ready_for_pickup",
  "picked_up",
  "delivered",
  "cancelled",
  "rejected",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

//
// TRANSITIONS
//

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["accepted", "rejected", "cancelled"],

  accepted: ["preparing"],

  preparing: ["ready_for_pickup"],

  ready_for_pickup: ["picked_up"],

  picked_up: ["delivered"],

  delivered: [],

  cancelled: [],

  rejected: [],
};

//
// ROLE ALLOWED STATUSES
//

export const CUSTOMER_ALLOWED_STATUSES: OrderStatus[] = ["cancelled"];

export const RESTAURANT_ALLOWED_STATUSES: OrderStatus[] = [
  "accepted",
  "rejected",
  "preparing",
  "ready_for_pickup",
];

export const RIDER_ALLOWED_STATUSES: OrderStatus[] = ["picked_up", "delivered"];

export const ADMIN_ALLOWED_STATUSES: OrderStatus[] = [
  "accepted",
  "rejected",
  "preparing",
  "ready_for_pickup",
  "picked_up",
  "delivered",
  "cancelled",
];
