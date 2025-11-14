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
    // Connection opened - validate API key after upgrade
    open(ws) {
      try {
        // Validate API key from query params
        const requestUrl = ws.data.request?.url;
        if (!requestUrl) {
          console.error("[WebSocket] No request URL available");
          ws.close(1008, "Invalid request");
          return;
        }

        const url = new URL(requestUrl);
        const clientApiKey = url.searchParams.get("api_key");

        if (!clientApiKey || clientApiKey !== apiKey) {
          console.warn("[WebSocket] Unauthorized connection attempt - closing");
          ws.close(1008, "Unauthorized - Invalid API key");
          return;
        }

        console.log("[WebSocket] Client authenticated and connected");

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
      } catch (error) {
        console.error("[WebSocket] Error in open handler:", error);
        ws.close(1011, "Internal server error");
      }
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
      // Log stack trace for debugging
      if (error instanceof Error) {
        console.error("[WebSocket] Error stack:", error.stack);
      }
    },
  });
}
