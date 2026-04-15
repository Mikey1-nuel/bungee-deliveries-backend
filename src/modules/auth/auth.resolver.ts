import { signup, login } from "./auth.service";
import { refreshAccessToken } from "./refresh.service";
import { requireAuth } from "../../middleware/role";
import { logout } from "./logout.service";
import { getUserSessions } from "./session.service";

export const authResolvers = {
  Query: {
    me: (_: any, __: any, context: any) => {
      requireAuth(context.user);
      return context.user;
    },
    mySessions: (_: any, __: any, context: any) => {
      requireAuth(context.user);
      return getUserSessions(context.user.id);
    },
  },

  Mutation: {
    signup: (_: any, args: any, context: any) => signup(args, context.req),
    login: (_: any, args: any, context: any) => login(args, context.req),
    refreshToken: (_: any, { token }: any) => refreshAccessToken(token),
    logout: async (_: any, __: any, context: any) => {
      return logout(context.sessionId, context.user.id);
    },
  },
};
