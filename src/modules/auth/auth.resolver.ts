import { signup, login } from "./auth.service";

import { logout } from "./logout.service";

import { refreshAccessToken } from "./refresh.service";

import { getUserSessions } from "./session.service";

import { requireAuth } from "../../middleware/role";

import { validateSession } from "./auth.service";

import { rotateRefreshToken } from "../../utils/tokens";

export const authResolvers = {
  Query: {
    me: (_: any, __: any, context: any) => {
      requireAuth(context.user);

      return context.user;
    },

    mySessions: async (_: any, __: any, context: any) => {
      requireAuth(context.user);

      return await getUserSessions(context.user.id);
    },
    validateSession: async (_: any, __: any, context: any) => {
      return validateSession(context.user);
    },
  },

  Mutation: {
    signup: (_: any, { input }: any, context: any) =>
      signup(input, context.req),

    login: async (_: any, { input }: any, context: any) => {
      return await login(input, context);
    },

    refreshToken: async (_: any, { token }: { token: string }) => {
      try {
        const tokens = await rotateRefreshToken(token);
        return tokens; // { accessToken, refreshToken }
      } catch (error: any) {
        throw new Error(error.message || "Token refresh failed");
      }
    },

    logout: async (_: any, __: any, context: any) => {
      if (!context.user) {
        throw new Error("Unauthorized");
      }

      return logout(context.sessionId, context.user.id);
    },
  },
};
