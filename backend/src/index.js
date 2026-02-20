import http from "http";

import cors from "cors";
import express from "express";

import { env } from "./config/env.js";
import { bootstrapDatabase } from "./db/bootstrap.js";
import { authRouter } from "./routes/auth.js";
import { friendRouter } from "./routes/friends.js";
import { healthRouter } from "./routes/health.js";
import { productRouter } from "./routes/products.js";
import { wishlistRouter } from "./routes/wishlists.js";
import { attachRealtimeServer } from "./realtime/server.js";

const app = express();

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());

app.use("/api", healthRouter);
app.use("/api", authRouter);
app.use("/api", friendRouter);
app.use("/api", wishlistRouter);
app.use("/api", productRouter);

app.use((err, _req, res, _next) => {
  // Failsafe error handler so API keeps predictable JSON response shape.
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});

const server = http.createServer(app);
attachRealtimeServer(server);

async function start() {
  await bootstrapDatabase();

  server.listen(env.port, () => {
    console.log(`API listening on http://localhost:${env.port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
