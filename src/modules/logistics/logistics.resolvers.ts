// logistics.resolvers.ts
import {
  getLogisticsOverview,
  getLogisticsRiders,
  assignRiderToOrder,
} from "./logistics.service";

export const logisticsResolvers = {
  Query: {
    getLogisticsOverview: async (_: any, __: any, { user }: any) => {
      if (!user) throw new Error("Unauthorized");
      return getLogisticsOverview(user);
    },
    getLogisticsRiders: async (_: any, __: any, { user }: any) => {
      if (!user) throw new Error("Unauthorized");
      return getLogisticsRiders(user);
    },
  },
  Mutation: {
    assignRiderToOrder: async (
      _: any,
      { orderId, riderId }: { orderId: string; riderId: string },
      { user }: any,
    ) => {
      if (!user) throw new Error("Unauthorized");
      return assignRiderToOrder(orderId, riderId);
    },
  },
};
