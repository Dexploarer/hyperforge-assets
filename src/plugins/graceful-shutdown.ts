/**
 * Graceful Shutdown Plugin
 * Handles clean server shutdown on SIGINT/SIGTERM
 */

import { Elysia } from "elysia";

export const gracefulShutdown = new Elysia({
  name: "graceful-shutdown",
}).onStop(async () => {
  console.log("\n[Shutdown] Graceful shutdown initiated...");

  // Wait brief moment for in-flight requests to finish
  // Elysia handles closing active connections via closeActiveConnections
  await new Promise((resolve) => setTimeout(resolve, 5000)); // 5s grace period

  console.log("[Shutdown] Graceful shutdown complete");
});
