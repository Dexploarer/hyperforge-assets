/**
 * Authentication Status Route
 * Returns authentication configuration and status
 * Public endpoint (no auth required)
 */

import { Elysia } from "elysia";
import { AuthStatusResponse } from "../types/models";

export function createAuthStatusRoute() {
  return new Elysia({ prefix: "/api", name: "auth-status" }).get(
    "/auth/status",
    () => {
      // Check if API key authentication is enabled
      const authEnabled = !!process.env.CDN_API_KEY;

      // For now, we'll always return authenticated=false since
      // the dashboard doesn't have session-based auth yet
      // This endpoint is mainly used to check if auth is enabled
      return {
        authEnabled,
        authenticated: false, // No session auth implemented yet
      };
    },
    {
      response: AuthStatusResponse,
      detail: {
        tags: ["Authentication"],
        summary: "Check authentication status",
        description:
          "Returns whether authentication is enabled and if the current session is authenticated. Public endpoint.",
      },
    }
  );
}
