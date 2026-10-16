import {
  getMyDeliveries,
  getMyEarnings,
  getMyRiderProfile,
  updateRiderAvailability,
  getMyDispatchBatches,
  acceptDispatchBatch,
  rejectDispatchBatch,
} from "./rider.service";

export const riderResolvers = {
  Query: {
    getMyDeliveries: async (_: any, __: any, { user }: any) => {
      if (!user) throw new Error("Unauthorized");
      return getMyDeliveries(user);
    },
    getMyEarnings: async (_: any, __: any, { user }: any) => {
      if (!user) throw new Error("Unauthorized");
      return getMyEarnings(user);
    },
    getMyRiderProfile: async (_: any, __: any, { user }: any) => {
      if (!user) throw new Error("Unauthorized");
      return getMyRiderProfile(user);
    },
    getMyDispatchBatches: async (_: any, __: any, { user }: any) => {
      if (!user) throw new Error("Unauthorized");
      return getMyDispatchBatches(user);
    },
  },
  Mutation: {
    updateRiderAvailability: async (
      _: any,
      { isAvailable }: { isAvailable: boolean },
      { user }: any,
    ) => {
      if (!user) throw new Error("Unauthorized");
      return updateRiderAvailability(user, isAvailable);
    },
    acceptDispatchBatch: async (
      _: any,
      { batchId }: { batchId: string },
      { user }: any,
    ) => {
      if (!user) throw new Error("Unauthorized");
      return acceptDispatchBatch(user, batchId);
    },
    rejectDispatchBatch: async (
      _: any,
      { batchId, reason }: { batchId: string; reason?: string },
      { user }: any,
    ) => {
      if (!user) throw new Error("Unauthorized");
      return rejectDispatchBatch(user, batchId, reason);
    },
  },
  RiderDelivery: {
    deliveryAddress: (order: any) => order.delivery_address,
    createdAt: (order: any) => order.created_at,
    pickedUpAt: (order: any) => order.picked_up_at,
    deliveredAt: (order: any) => order.delivered_at,
  },
};
