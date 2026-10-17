import "dotenv/config";
import http from "http";

import jwt from "jsonwebtoken";

import { ApolloServer } from "@apollo/server";

import { expressMiddleware } from "@as-integrations/express5";

import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";

import { app } from "./app";

import { typeDefs } from "./graphql/schema";

import { resolvers } from "./graphql/resolvers";

import uploadRoute from "./routes/upload";

import { initSocket } from "./socket";

//
// JWT PAYLOAD TYPE
//

export interface JwtPayload {
  id: string;

  email: string;

  role: string;

  sessionId: string;
}

//
// HTTP SERVER
//

const httpServer = http.createServer(app);

//
// INIT SOCKET
//

initSocket(httpServer);

//
// VERIFY TOKEN
//

const getUserFromToken = (token: string): JwtPayload | null => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

    return decoded;
  } catch (error) {
    console.log("JWT VERIFY ERROR:", error);

    return null;
  }
};

async function startServer() {
  //
  // APOLLO SERVER
  //

  const server = new ApolloServer({
    typeDefs,

    resolvers,

    plugins: [
      ApolloServerPluginDrainHttpServer({
        httpServer,
      }),
    ],
  });

  //
  // START APOLLO
  //

  await server.start();

  //
  // GRAPHQL MIDDLEWARE
  //

  app.use(
    "/graphql",

    expressMiddleware(server, {
      context: async ({ req }) => {
        try {
          //
          // AUTH HEADER
          //

          const authHeader = req.headers.authorization;

          console.log("AUTH HEADER:", authHeader);

          //
          // NO TOKEN
          //

          if (!authHeader) {
            return {
              req,

              user: null,
            };
          }

          //
          // EXTRACT TOKEN
          //

          const token = authHeader.replace("Bearer ", "");

          //
          // VERIFY USER
          //

          const user = getUserFromToken(token);

          //
          // RETURN CONTEXT
          //

          return {
            req,

            user,
          };
        } catch (error) {
          console.log("CONTEXT ERROR:", error);

          return {
            req,

            user: null,
          };
        }
      },
    }),
  );

  //
  // STATIC UPLOADS
  //

  app.use("/uploads", uploadRoute);

  //
  // START SERVER
  //

  const PORT = process.env.PORT || 4000;

  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
