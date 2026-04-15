import { requireRole } from "../../middleware/role";
import { logAction } from "../audit/audit.service";
import { updateUserStatus } from "../user/user.service";

export const adminResolvers = {
  Mutation: {
    deleteUser: async (_: any, { userId }: any, context: any) => {
      requireRole(context.user, ["admin"]);

      await logAction({
        userId: context.user.id,
        action: "DELETE_USER",
        entity: "USER",
        entityId: userId,
      });

      return `User ${userId} deleted`;
    },

    banUser: async (_: any, { userId }: any, context: any) => {
      requireRole(context.user, ["admin"]);

      await logAction({
        userId: context.user.id,
        action: "BAN_USER",
        entity: "USER",
        entityId: userId,
      });

      return updateUserStatus(userId, "banned");
    },
  },
};
