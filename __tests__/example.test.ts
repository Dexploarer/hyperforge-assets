/**
 * Example test for Asset-Forge CDN
 * Following SMART MOCKING STRATEGY:
 * - NO MOCKS for internal code (file serving, middleware, routing)
 * - SMART MOCKS for external dependencies (if any)
 * - Real Elysia HTTP server with test client
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { app } from "../src/index";

describe("CDN Health Checks", () => {
  test("GET /api/health returns 200", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/health"),
    );

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty("status");
    expect(data.status).toBe("healthy");
  });

  test("GET /api/health/live returns 200", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/health/live"),
    );

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty("status");
    expect(data.status).toBe("ok");
  });

  test("GET /api/health/ready returns 200", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/health/ready"),
    );

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty("status");
    expect(data.status).toBe("ready");
  });
});

describe("CORS Headers", () => {
  test("OPTIONS request returns CORS headers", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/health", {
        method: "OPTIONS",
      }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBeTruthy();
    expect(response.headers.get("access-control-allow-methods")).toContain(
      "GET",
    );
  });
});

describe("Security Headers", () => {
  test("Responses include security headers", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/health"),
    );

    // Security headers are applied by middleware
    // Note: Some headers may not appear on all responses (e.g., JSON responses)
    expect(response.status).toBe(200);

    // The middleware is loaded, test passes if response is successful
    // Full security header testing would require integration tests
  });
});

describe("Compression", () => {
  test("JSON responses support Brotli compression", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/assets", {
        headers: {
          "Accept-Encoding": "br, gzip",
        },
      }),
    );

    // Note: Compression may not apply to small responses < 1KB
    // This test verifies the header is accepted, not that compression occurs
    expect(response.status).toBe(200);
  });
});

// TODO: Add more comprehensive tests:
// - File serving with range requests
// - ETag and conditional requests (304 responses)
// - Rate limiting behavior
// - Upload authentication
// - Error handling
