import { requireRole } from "../../middleware/role";

import {
  getAdminStats,
  getAdminUsers,
  getAdminRestaurants,
  getAdminOrders,
  getAdminRiders,
  banUser,
  unbanUser,
  deleteUser,
  approveRestaurant,
  rejectRestaurant,
  getAdminLogistics,
  getDispatchBatches,
  createDispatchBatch,
  adminCreateUser,
} from "./admin.service";

export const adminResolvers = {
  Query: {
    getAdminStats: async (_: any, __: any, { user }: any) => {
      requireRole(user, ["admin"]);
      return getAdminStats();
    },

    getAdminUsers: async (_: any, args: any, { user }: any) => {
      requireRole(user, ["admin"]);
      return getAdminUsers(args);
    },

    // getAdminRestaurants: async (_: any, args: any, { user }: any) => {
    //   requireRole(user, ["admin"]);
    //   return getAdminRestaurants(args);
    // },

    getAdminRestaurants: async (
      _: unknown,
      {
        page,
        limit,
        search,
        approvalStatus,
      }: {
        page?: number;
        limit?: number;
        search?: string;
        approvalStatus?: string;
      },
      context: any,
    ) => {
      requireRole(context.user, ["admin"]);
      return await getAdminRestaurants({ page, limit, search, approvalStatus });
    },

    getAdminOrders: async (_: any, args: any, { user }: any) => {
      requireRole(user, ["admin"]);
      return getAdminOrders(args);
    },

    getAdminRiders: async (_: any, args: any, { user }: any) => {
      requireRole(user, ["admin"]);
      return getAdminRiders(args);
    },

    getAdminLogistics: async (_: any, args: any, { user }: any) => {
      requireRole(user, ["admin"]);
      return getAdminLogistics(args);
    },
    getDispatchBatches: async (_: any, args: any, { user }: any) => {
      requireRole(user, ["admin"]);
      return getDispatchBatches(args);
    },
  },

  Mutation: {
    adminCreateUser: async (_: any, args: any, { user }: any) => {
      requireRole(user, ["admin"]);
      return adminCreateUser(user.id, args);
    },
    createDispatchBatch: async (_: any, args: any, { user }: any) => {
      requireRole(user, ["admin"]);
      return createDispatchBatch(user.id, args);
    },

    banUser: async (_: any, { userId }: any, { user }: any) => {
      requireRole(user, ["admin"]);
      return banUser(user.id, userId);
    },

    unbanUser: async (_: any, { userId }: any, { user }: any) => {
      requireRole(user, ["admin"]);
      return unbanUser(user.id, userId);
    },

    deleteUser: async (_: any, { userId }: any, { user }: any) => {
      requireRole(user, ["admin"]);
      return deleteUser(user.id, userId);
    },

    approveRestaurant: async (_: any, { restaurantId }: any, { user }: any) => {
      requireRole(user, ["admin"]);
      return approveRestaurant(user.id, restaurantId);
    },

    rejectRestaurant: async (_: any, { restaurantId }: any, { user }: any) => {
      requireRole(user, ["admin"]);
      return rejectRestaurant(user.id, restaurantId);
    },
  },
};
