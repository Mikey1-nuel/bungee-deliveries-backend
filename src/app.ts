import express from "express";

import cors from "cors";

import cookieParser from "cookie-parser";

export const app = express();
import { corsOriginCheck } from "./config/cors";

//
// CORS
//

app.use(
  cors({
    origin: corsOriginCheck,
    credentials: true,
  }),
);

//
// MIDDLEWARES
//

app.use(express.json());

app.use(cookieParser());
