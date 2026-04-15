export const authResolvers = {
  Mutation: {
    login: async (_: any, { email, password }: any) => {
      // TODO: connect to DB later
      return {
        token: "mock-token",
        user: {
          id: "1",
          name: "Mikey",
          role: "USER",
        },
      };
    },
  },
};
