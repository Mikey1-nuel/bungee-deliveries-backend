import express from "express";
// import bodyParser from "body-parser";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express5";

import { typeDefs } from "./graphql/schema";
import { resolvers } from "./graphql/resolvers";
import { getUserFromToken } from "./middleware/auth";

const app = express();

async function startServer() {
  const server = new ApolloServer({
    typeDefs,
    resolvers,
  });

  await server.start();

  app.use(
    "/graphql",
    express.json(),
    expressMiddleware(server, {
      context: async ({ req }) => ({
        user: getUserFromToken(req),
      }),
    }),
  );

  app.listen(5000, () => {
    console.log("🚀 Server running on http://localhost:5000/graphql");
  });
}

startServer();
