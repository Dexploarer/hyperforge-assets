/**
 * WebSocket Event Server
 * Real-time event broadcasting for CDN uploads
 * Clients authenticate with API key and subscribe to upload events
 */

import { Elysia, t } from "elysia";

export function createWebSocketRoute() {
  const apiKey = process.env.CDN_API_KEY;

  if (!apiKey) {
    console.warn(
      "[WebSocket] CDN_API_KEY not configured - WebSocket server disabled",
    );
    return new Elysia({ prefix: "/ws", name: "websocket" });
  }

  return new Elysia({ prefix: "/ws", name: "websocket" }).ws("/events", {
    // Connection opened
    open(ws) {
      console.log("[WebSocket] Client connected");

      // Subscribe client to cdn-uploads topic
      ws.subscribe("cdn-uploads");
      console.log(`[WebSocket] Client subscribed to cdn-uploads topic`);

      // Send welcome message
      ws.send(
        JSON.stringify({
          type: "connection",
          message: "Connected to CDN event stream",
          topics: ["cdn-uploads"],
          timestamp: new Date().toISOString(),
        }),
      );
    },

    // Handle incoming messages (if client needs to send commands)
    message(ws, message) {
      console.log("[WebSocket] Received message from client:", message);

      // Echo back for debugging
      ws.send(
        JSON.stringify({
          type: "echo",
          message,
          timestamp: new Date().toISOString(),
        }),
      );
    },

    // Connection closed
    close(ws) {
      console.log("[WebSocket] Client disconnected");
    },

    // Error handling - Note: Elysia WS error handler takes a single context parameter
    error({ error }) {
      console.error("[WebSocket] Error:", error);
    },
  });
}
