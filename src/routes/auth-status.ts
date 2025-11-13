/**
 * Authentication Status Route
 * Returns authentication configuration and status
 * Public endpoint (no auth required)
 */

import { Elysia, t } from "elysia";
import { AuthStatusResponse } from "../types/models";
import {
  parseSessionCookie,
  getDashboardSession,
  createDashboardSession,
  deleteDashboardSession,
  createSessionCookie,
  createLogoutCookie,
} from "../middleware/auth";

export function createAuthStatusRoute() {
  return new Elysia({ prefix: "/api", name: "auth-routes" })
    .get(
      "/auth/status",
      ({ request }) => {
        // Check if Privy authentication is enabled
        const authEnabled =
          !!process.env.PRIVY_APP_ID && !!process.env.PRIVY_APP_SECRET;

        if (!authEnabled) {
          return {
            authEnabled: false,
            authenticated: false,
          };
        }

        // Check for session cookie
        const cookieHeader = request.headers.get("cookie");
        const sessionId = parseSessionCookie(cookieHeader);

        if (!sessionId) {
          return {
            authEnabled: true,
            authenticated: false,
          };
        }

        // Validate session
        const session = getDashboardSession(sessionId);
        return {
          authEnabled: true,
          authenticated: !!session,
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
      },
    )
    .post(
      "/auth/verify",
      async ({ body, set }) => {
        const { token } = body as { token: string };

        if (!token) {
          set.status = 400;
          return {
            success: false,
            error: "Token is required",
          };
        }

        // Check if Privy is configured
        const privyConfigured =
          process.env.PRIVY_APP_ID && process.env.PRIVY_APP_SECRET;

        if (!privyConfigured) {
          set.status = 503;
          return {
            success: false,
            error: "Authentication not configured on server",
          };
        }

        try {
          // Verify Privy JWT token
          const { PrivyClient } = await import("@privy-io/server-auth");
          const privy = new PrivyClient(
            process.env.PRIVY_APP_ID!,
            process.env.PRIVY_APP_SECRET!,
          );

          const verifiedClaims = await privy.verifyAuthToken(token);

          // Create dashboard session
          const session = createDashboardSession(
            verifiedClaims.userId,
            verifiedClaims.userId,
          );

          // Set session cookie
          set.headers["Set-Cookie"] = createSessionCookie(session.sessionId);

          console.log(
            `[Dashboard Auth] User logged in: ${verifiedClaims.userId}`,
          );

          return {
            success: true,
            message: "Authentication successful",
          };
        } catch (error) {
          console.error("[Dashboard Auth] Token verification failed:", error);
          set.status = 401;
          return {
            success: false,
            error: "Invalid or expired token",
          };
        }
      },
      {
        body: t.Object({
          token: t.String(),
        }),
        detail: {
          tags: ["Authentication"],
          summary: "Verify Privy JWT token",
          description:
            "Verify a Privy JWT token and create a dashboard session. Sets a session cookie on success.",
        },
      },
    )
    .post(
      "/auth/logout",
      ({ request, set }) => {
        const cookieHeader = request.headers.get("cookie");
        const sessionId = parseSessionCookie(cookieHeader);

        if (sessionId) {
          deleteDashboardSession(sessionId);
          console.log(`[Dashboard Auth] User logged out: ${sessionId}`);
        }

        // Clear session cookie
        set.headers["Set-Cookie"] = createLogoutCookie();

        return {
          success: true,
          message: "Logged out successfully",
        };
      },
      {
        detail: {
          tags: ["Authentication"],
          summary: "Logout",
          description:
            "Logout the current dashboard session. Clears the session cookie.",
        },
      },
    );
}
