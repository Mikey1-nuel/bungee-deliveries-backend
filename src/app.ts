import express from "express";

import cors from "cors";

import cookieParser from "cookie-parser";

export const app = express();
import { allowedOrigins } from "./config/cors";

//
// CORS
//

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked for origin: ${origin}`));
      }
    },

    credentials: true,
  }),
);

//
// MIDDLEWARES
//

app.use(express.json());

app.use(cookieParser());
