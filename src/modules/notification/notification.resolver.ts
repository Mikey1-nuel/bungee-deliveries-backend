import {
  getMyNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  registerPushToken,
} from "./notification.service";

export const notificationResolvers = {
  Query: {
    getMyNotifications: async (_: any, __: any, { user }: any) => {
      if (!user) {
        throw new Error("Unauthorized");
      }

      return getMyNotifications(user.id);
    },

    notificationStats: async (_: any, __: any, { user }: any) => {
      if (!user) {
        throw new Error("Unauthorized");
      }

      const unreadCount = await getUnreadCount(user.id);

      return {
        unreadCount,
      };
    },
  },

  Mutation: {
    markNotificationAsRead: async (
      _: any,
      { notificationId }: any,
      { user }: any,
    ) => {
      if (!user) {
        throw new Error("Unauthorized");
      }

      return markNotificationAsRead(notificationId, user.id);
    },

    markAllNotificationsAsRead: async (_: any, __: any, { user }: any) => {
      if (!user) {
        throw new Error("Unauthorized");
      }

      return markAllNotificationsAsRead(user.id);
    },

    registerPushToken: async (
      _: any,
      { token, device }: any,
      { user }: any,
    ) => {
      if (!user) {
        throw new Error("Unauthorized");
      }

      return registerPushToken({
        userId: user.id,
        token,
        device,
      });
    },
  },
};
