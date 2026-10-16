import { authResolvers } from "../../modules/auth/auth.resolver";
import { adminResolvers } from "../../modules/admin/admin.resolver";
import { menuResolvers } from "../../modules/restaurant/menu.resolver";
import { restaurantResolvers } from "../../modules/restaurant/restaurant.resolver";
import { categoryResolvers } from "../../modules/category/category.resolver";
import { orderResolvers } from "../../modules/order/order.resolver";
import { notificationResolvers } from "../../modules/notification/notification.resolver";
import { riderResolvers } from "../../modules/rider/rider.resolvers";
import { logisticsResolvers } from "../../modules/logistics/logistics.resolvers";

export const resolvers = {
  Query: {
    ...authResolvers.Query,
    ...adminResolvers.Query,
    ...categoryResolvers.Query,
    ...restaurantResolvers.Query,
    ...menuResolvers.Query,
    ...orderResolvers.Query,
    ...notificationResolvers.Query,
    ...riderResolvers.Query,
    ...logisticsResolvers.Query,
  },

  Mutation: {
    ...authResolvers.Mutation,
    ...adminResolvers.Mutation,
    ...restaurantResolvers.Mutation,
    ...menuResolvers.Mutation,
    ...orderResolvers.Mutation,
    ...notificationResolvers.Mutation,
    ...riderResolvers.Mutation,
    ...logisticsResolvers.Mutation,
  },
  Order: orderResolvers.Order,
  OrderItem: orderResolvers.OrderItem,
  RiderDelivery: riderResolvers.RiderDelivery,
};
