import express from "express";
import cors from "cors";

export const app = express();

app.use(cors());
app.use(express.json());

// import express from "express";
// import { pool } from "./config/db";

// const app = express();

// app.get("/test-db", async (req, res) => {
//   try {
//     const result = await pool.query("SELECT NOW()");
//     res.json(result.rows[0]);
//   } catch (err) {
//     console.error(err);
//     res.status(500).send("DB connection failed");
//   }
// });

// app.listen(5000, () => console.log("Server running on port 5000"));
