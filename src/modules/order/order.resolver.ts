import {
  createOrder,
  getMyOrders,
  getRestaurantOrders,
  getRestaurantOrderStats,
  updateOrderStatus,
} from "./order.service";
import { checkoutCart } from "../payment/checkoutCart.service";
import { CheckoutCartInput } from "../payment/checkoutCart.service";
import { AuthUser } from "../restaurant/menu.service";

export const orderResolvers = {
  Order: {
    deliveryAddress: (order: any) => order.delivery_address,
    createdAt: (order: any) => order.created_at,
    acceptedAt: (order: any) => order.accepted_at,
    preparedAt: (order: any) => order.prepared_at,
    pickedUpAt: (order: any) => order.picked_up_at,
    deliveredAt: (order: any) => order.delivered_at,
  },

  OrderItem: {
    restaurantMenuId: (item: any) => item.restaurant_menu_id,

    menuName: (item: any) => item.menu_name,

    menuType: (item: any) => item.menu_type,

    unitPrice: (item: any) => Number(item.unit_price),

    totalPrice: (item: any) => Number(item.total_price),

    menuImage: (item: any) => item.menu_image,
  },

  Query: {
    getMyOrders: async (_: unknown, __: unknown, context: any) => {
      if (!context.user) {
        throw new Error("Unauthorized");
      }

      return getMyOrders(context.user);
    },

    getRestaurantOrders: async (
      _: unknown,
      { page = 1, limit = 20, search, status }: any,
      context: any,
    ) => {
      if (!context.user) {
        throw new Error("Unauthorized");
      }

      return getRestaurantOrders({
        user: context.user,
        page,
        limit,
        search,
        status,
      });
    },

    getRestaurantOrderStats: async (_: unknown, __: unknown, context: any) => {
      if (!context.user) {
        throw new Error("Unauthorized");
      }

      return getRestaurantOrderStats(context.user);
    },
  },

  Mutation: {
    createOrder: async (_: unknown, { input }: any, context: any) => {
      if (!context.user) {
        throw new Error("Unauthorized");
      }

      const formattedInput = {
        restaurant_id: input.restaurantId,

        delivery_address: input.deliveryAddress,

        items: input.items.map((item: any) => ({
          restaurant_menu_id: item.restaurantMenuId,

          quantity: item.quantity,
        })),
      };

      return createOrder(formattedInput, context.user);
    },

    updateOrderStatus: async (
      _: unknown,
      { orderId, status }: any,
      context: any,
    ) => {
      if (!context.user) {
        throw new Error("Unauthorized");
      }

      return updateOrderStatus(orderId, status, context.user);
    },

    checkoutCart: async (_: unknown, { input }: any, context: any) => {
      if (!context.user) {
        throw new Error("Authentication required");
      }

      const formattedInput: CheckoutCartInput = {
        delivery_address: input.deliveryAddress,

        items: input.items.map((item: any) => ({
          restaurant_menu_id: item.restaurantMenuId,

          quantity: item.quantity,
        })),
      };

      return checkoutCart(formattedInput, context.user);
    },
  },
};
