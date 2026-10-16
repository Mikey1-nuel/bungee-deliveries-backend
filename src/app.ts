import express from "express";

import cors from "cors";

import cookieParser from "cookie-parser";

export const app = express();

//
// CORS
//

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "https://bungee-deliveries-git-development-mikey1nuels-projects.vercel.app",
    ],

    credentials: true,
  }),
);

//
// MIDDLEWARES
//

app.use(express.json());

app.use(cookieParser());
