import { signup, login } from "../../modules/auth/auth.service";

export const authResolvers = {
  Mutation: {
    signup,
    login
  },
};

