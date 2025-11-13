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
    // Schema for upgrade data
    upgradeData: t.Object({
      apiKey: t.String(),
    }),

    // Authenticate before upgrading to WebSocket
    beforeHandle({ request, set }) {
      const clientApiKey =
        request.headers.get("x-api-key") ||
        new URL(request.url).searchParams.get("api_key");

      if (!clientApiKey || clientApiKey !== apiKey) {
        console.warn("[WebSocket] Unauthorized connection attempt");
        set.status = 401;
        return { error: "Unauthorized - Invalid API key" };
      }

      console.log("[WebSocket] API key validated");
      return { apiKey: clientApiKey };
    },

    // Connection opened
    open(ws) {
      // Subscribe client to cdn-uploads topic
      ws.subscribe("cdn-uploads");
      console.log(
        `[WebSocket] Client connected and subscribed to cdn-uploads topic`,
      );

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

    // Error handling
    error(ws, error) {
      console.error("[WebSocket] Error:", error);
    },
  });
}
