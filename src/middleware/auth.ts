/**
 * Authentication Middleware
 * Supports two authentication methods:
 * 1. Service API Key - For Asset-Forge backend service-to-service calls
 * 2. Privy JWT - For direct user uploads (future feature)
 */

import { Elysia } from "elysia";

/**
 * Validate Privy JWT token (for direct user uploads)
 * Requires PRIVY_APP_ID and PRIVY_APP_SECRET in environment
 */
async function validatePrivyToken(
  authToken: string,
): Promise<{ userId: string; walletAddress: string } | null> {
  try {
    // Import Privy server SDK if available
    const { PrivyClient } = await import("@privy-io/server-auth");

    const privy = new PrivyClient(
      process.env.PRIVY_APP_ID!,
      process.env.PRIVY_APP_SECRET!,
    );

    const verifiedClaims = await privy.verifyAuthToken(authToken);

    return {
      userId: verifiedClaims.userId,
      walletAddress: verifiedClaims.userId, // Use userId as wallet identifier
    };
  } catch (error) {
    console.error("[Auth] Privy token validation failed:", error);
    return null;
  }
}

/**
 * API Key authentication middleware (for service-to-service)
 * Validates API key from Authorization header or X-API-Key header
 */
export function requireApiKey() {
  return new Elysia({ name: "require-api-key" }).onBeforeHandle(
    ({ request, set }) => {
      // Get API key from environment
      const validApiKey = process.env.CDN_API_KEY;

      // If no API key is configured, allow all requests (development mode)
      if (!validApiKey) {
        console.warn(
          "[Auth] No CDN_API_KEY configured - authentication disabled!",
        );
        return;
      }

      // Extract API key from request
      const authHeader = request.headers.get("authorization");
      const apiKeyHeader = request.headers.get("x-api-key");

      let providedKey: string | null = null;

      // Check Authorization header (Bearer token)
      if (authHeader?.startsWith("Bearer ")) {
        providedKey = authHeader.substring(7);
      }
      // Check X-API-Key header
      else if (apiKeyHeader) {
        providedKey = apiKeyHeader;
      }

      // Validate API key
      if (!providedKey || providedKey !== validApiKey) {
        set.status = 401;
        return new Response(
          JSON.stringify({
            error: "UNAUTHORIZED",
            message: "Invalid or missing API key",
            hint: "Provide API key via 'Authorization: Bearer YOUR_KEY' or 'X-API-Key: YOUR_KEY' header",
          }),
          {
            status: 401,
            headers: {
              "Content-Type": "application/json",
              "WWW-Authenticate": 'Bearer realm="CDN API"',
            },
          },
        );
      }

      // API key is valid - continue
      console.log("[Auth] Service API key validated successfully");
    },
  );
}

/**
 * Flexible authentication middleware
 * Accepts either:
 * 1. Service API Key (X-API-Key header or Authorization: Bearer <key>)
 * 2. Privy JWT token (Authorization: Bearer <jwt>)
 */
export function requireAuth() {
  return new Elysia({ name: "require-auth" }).derive(
    async ({ request, set }) => {
      const serviceApiKey = process.env.CDN_API_KEY;
      const privyConfigured =
        process.env.PRIVY_APP_ID && process.env.PRIVY_APP_SECRET;

      // No auth configured - allow (development mode)
      if (!serviceApiKey && !privyConfigured) {
        console.warn(
          "[Auth] No authentication configured - all requests allowed!",
        );
        return { authenticated: true, authType: "none", userId: "anonymous" };
      }

      // Get auth headers
      const authHeader = request.headers.get("authorization");
      const apiKeyHeader = request.headers.get("x-api-key");

      // Try service API key first (X-API-Key or short Bearer token)
      if (apiKeyHeader || (authHeader && !authHeader.includes("."))) {
        const providedKey = apiKeyHeader || authHeader?.substring(7);

        if (providedKey === serviceApiKey) {
          console.log("[Auth] Service API key validated");
          return {
            authenticated: true,
            authType: "service",
            userId: "asset-forge-backend",
          };
        }
      }

      // Try Privy JWT token (long Bearer token with dots)
      if (
        privyConfigured &&
        authHeader?.startsWith("Bearer ") &&
        authHeader.includes(".")
      ) {
        const token = authHeader.substring(7);
        const privyUser = await validatePrivyToken(token);

        if (privyUser) {
          console.log(
            `[Auth] Privy user authenticated: ${privyUser.walletAddress}`,
          );
          return {
            authenticated: true,
            authType: "privy",
            userId: privyUser.userId,
            walletAddress: privyUser.walletAddress,
          };
        }
      }

      // Authentication failed
      set.status = 401;
      throw new Error(
        JSON.stringify({
          error: "UNAUTHORIZED",
          message: "Invalid or missing authentication",
          hint: "Provide either: (1) Service API key via X-API-Key header, or (2) Privy JWT token via Authorization: Bearer header",
        }),
      );
    },
  );
}

/**
 * Optional API key authentication
 * Validates API key if provided, but doesn't require it
 * Useful for endpoints that have different behavior for authenticated vs unauthenticated requests
 */
export function optionalApiKey() {
  return new Elysia({ name: "optional-api-key" }).derive(({ request }) => {
    const validApiKey = process.env.CDN_API_KEY;

    if (!validApiKey) {
      return { isAuthenticated: false };
    }

    // Extract API key from request
    const authHeader = request.headers.get("authorization");
    const apiKeyHeader = request.headers.get("x-api-key");

    let providedKey: string | null = null;

    if (authHeader?.startsWith("Bearer ")) {
      providedKey = authHeader.substring(7);
    } else if (apiKeyHeader) {
      providedKey = apiKeyHeader;
    }

    // Check if API key is valid
    const isAuthenticated = providedKey === validApiKey;

    return { isAuthenticated };
  });
}

/**
 * Generate a secure random API key
 * Use this to generate a new API key for CDN_API_KEY environment variable
 */
export function generateApiKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

// Log authentication configuration on module load
console.log("\n[Auth] Authentication Configuration:");
if (process.env.CDN_API_KEY) {
  console.log("  ✅ Service API Key: Enabled");
} else {
  console.warn("  ⚠️  Service API Key: Disabled (CDN_API_KEY not set)");
}

if (process.env.PRIVY_APP_ID && process.env.PRIVY_APP_SECRET) {
  console.log("  ✅ Privy Authentication: Enabled");
} else {
  console.log("  ℹ️  Privy Authentication: Disabled (optional)");
}

if (!process.env.CDN_API_KEY) {
  console.warn(
    "\n  ⚠️  WARNING: No authentication configured! Generate a key with:\n     bun -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\"\n",
  );
}
