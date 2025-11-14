/**
 * Asset-Forge CDN - Elysia TypeScript Server v2.0
 * High-performance CDN for serving stable game assets
 *
 * Features:
 * - Fast static file serving with Bun.file()
 * - Range request support for audio/video streaming
 * - ETag support for conditional requests (304 responses)
 * - Brotli/Gzip compression for text-based content
 * - Rate limiting to prevent abuse
 * - API key authentication for uploads
 * - Comprehensive security headers
 * - Type-safe file uploads with TypeBox validation
 * - CORS enabled for cross-origin requests
 * - Swagger API documentation
 * - Kubernetes-ready health checks
 * - Graceful shutdown handling
 * - Structured logging with Pino (high-performance, JSON logs)
 */

import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { join } from "path";

// Middleware and plugins
import { errorHandler } from "./middleware/errorHandler";
import { gracefulShutdown } from "./plugins/graceful-shutdown";
// import { compression } from "./middleware/compression"; // TEMPORARILY DISABLED
import { securityHeaders } from "./middleware/security";
// import { apiRateLimit, staticFileRateLimit } from "./middleware/rateLimit"; // TEMPORARILY DISABLED
import { requireDashboardAuth } from "./middleware/auth";

// Routes
import { healthRoutes } from "./routes/health";
import { createAssetsRoute } from "./routes/assets";
import { createUploadRoute } from "./routes/upload";
import { createAuthStatusRoute } from "./routes/auth-status";
import { createFilesRoute } from "./routes/files";
import { createManagementRoute } from "./routes/management";
import { createBulkDownloadRoute } from "./routes/bulk-download";
import { createConfigRoute } from "./routes/config";
import { createWebSocketRoute } from "./routes/websocket";

// Utilities
import { serveFile, serveFileHead } from "./utils/file-server";

// Configuration from environment variables
const ROOT_DIR = process.cwd();
// Use Railway volume mount path if available, otherwise use DATA_DIR env var, fallback to ROOT_DIR
const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || process.env.DATA_DIR || ROOT_DIR;
const PORT = process.env.PORT || 3005;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

// Log directory paths for debugging
console.log(`[Config] ROOT_DIR: ${ROOT_DIR}`);
console.log(`[Config] DATA_DIR: ${DATA_DIR}`);
console.log(`[Config] Dashboard path: ${join(ROOT_DIR, "dashboard")}`);

// Asset directories to serve
const ASSET_DIRS = ["models", "emotes", "music"];

// Create Elysia app
const app = new Elysia()
  // Graceful shutdown handler
  .use(gracefulShutdown)

  // Swagger API documentation
  .use(
    swagger({
      documentation: {
        info: {
          title: "Asset-Forge CDN API",
          version: "2.0.0",
          description:
            "High-performance CDN for 3D game assets with range requests, ETags, compression, and rate limiting",
        },
        tags: [
          { name: "Health", description: "Health check endpoints" },
          { name: "Assets", description: "Asset listing and browsing" },
          { name: "Upload", description: "File upload management" },
        ],
      },
    }),
  )

  // CORS configuration - Enhanced to support range requests and ETags
  .use(
    cors({
      origin: CORS_ORIGIN,
      credentials: true,
      methods: ["GET", "POST", "HEAD", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-API-Key",
        "Range", // For partial content requests
        "If-None-Match", // For ETag conditional requests
        "If-Modified-Since",
      ],
      exposeHeaders: [
        "Content-Range", // For range responses
        "Accept-Ranges",
        "ETag",
        "Last-Modified",
        "Content-Length",
        "Content-Encoding",
        "X-RateLimit-Limit", // Rate limit info
        "X-RateLimit-Remaining",
        "X-RateLimit-Reset",
      ],
      maxAge: 86400, // Cache preflight for 24 hours
    }),
  )

  // Security headers middleware (apply early)
  .use(securityHeaders())

  // Compression middleware (before routes, after CORS)
  // TEMPORARILY DISABLED - debugging 502 errors
  // .use(compression)

  // Rate limiting for API endpoints (exclude static files)
  // TEMPORARILY DISABLED - debugging 502 errors
  // .use(apiRateLimit)

  // Error handling middleware
  .use(errorHandler)

  // ============================================
  // API ROUTES
  // ============================================
  .use(healthRoutes)
  .use(createAssetsRoute(DATA_DIR, ASSET_DIRS))
  .use(createUploadRoute(DATA_DIR))
  .use(createAuthStatusRoute())
  .use(createFilesRoute(DATA_DIR, ASSET_DIRS))
  .use(createManagementRoute(DATA_DIR, ASSET_DIRS))
  .use(createBulkDownloadRoute(DATA_DIR))
  .use(createConfigRoute(DATA_DIR, ASSET_DIRS))
  .use(createWebSocketRoute())

  // ============================================
  // STATIC FILE SERVING WITH ADVANCED FEATURES
  // All routes use: Range requests, ETags, 304 responses
  // ============================================

  // Apply rate limiting to static file routes
  // TEMPORARILY DISABLED - debugging 502 errors
  // .use(staticFileRateLimit)

  // Models directory - 3D GLB files, metadata, textures
  .get("/models/*", async (context) => {
    const relativePath = (context.params as any)["*"] || "";
    const filePath = join(DATA_DIR, "models", relativePath);
    return serveFile(filePath, context);
  })
  .head("/models/*", async (context) => {
    const relativePath = (context.params as any)["*"] || "";
    const filePath = join(DATA_DIR, "models", relativePath);
    return serveFileHead(filePath, context);
  })

  // Emotes directory - Animation GLB files
  .get("/emotes/*", async (context) => {
    const relativePath = (context.params as any)["*"] || "";
    const filePath = join(DATA_DIR, "emotes", relativePath);
    return serveFile(filePath, context, {
      contentType: "model/gltf-binary",
    });
  })
  .head("/emotes/*", async (context) => {
    const relativePath = (context.params as any)["*"] || "";
    const filePath = join(DATA_DIR, "emotes", relativePath);
    return serveFileHead(filePath, context, {
      contentType: "model/gltf-binary",
    });
  })

  // Music directory - Audio files (MP3, WAV, OGG)
  // Range requests are critical for audio seeking
  .get("/music/*", async (context) => {
    const relativePath = (context.params as any)["*"] || "";
    const filePath = join(DATA_DIR, "music", relativePath);
    return serveFile(filePath, context, {
      contentType: "audio/mpeg",
    });
  })
  .head("/music/*", async (context) => {
    const relativePath = (context.params as any)["*"] || "";
    const filePath = join(DATA_DIR, "music", relativePath);
    return serveFileHead(filePath, context, {
      contentType: "audio/mpeg",
    });
  })

  // Favicon handler (prevent 404 errors in browsers)
  .get("/favicon.ico", () => {
    return new Response(null, { status: 204 });
  })

  // Dashboard - Asset browser UI
  // Login page and assets are public (no auth required)
  // Elysia automatically handles HEAD requests when returning Bun.file()
  .get("/dashboard/login", async ({ set }) => {
    try {
      const filePath = join(ROOT_DIR, "dashboard", "login.html");
      const file = Bun.file(filePath);
      if (!(await file.exists())) {
        console.error(`[Dashboard] File not found: ${filePath}`);
        set.status = 404;
        return new Response("File not found", { status: 404 });
      }
      set.headers["Cache-Control"] = "no-cache";
      return file;
    } catch (error) {
      console.error("[Dashboard] Error serving login.html:", error);
      set.status = 500;
      return new Response("Internal Server Error", { status: 500 });
    }
  })
  .get("/dashboard/login.html", async ({ set }) => {
    try {
      const filePath = join(ROOT_DIR, "dashboard", "login.html");
      const file = Bun.file(filePath);
      if (!(await file.exists())) {
        console.error(`[Dashboard] File not found: ${filePath}`);
        set.status = 404;
        return new Response("File not found", { status: 404 });
      }
      set.headers["Cache-Control"] = "no-cache";
      return file;
    } catch (error) {
      console.error("[Dashboard] Error serving login.html:", error);
      set.status = 500;
      return new Response("Internal Server Error", { status: 500 });
    }
  })
  .get("/dashboard/login.js", async ({ set }) => {
    try {
      const filePath = join(ROOT_DIR, "dashboard", "login.js");
      const file = Bun.file(filePath);
      if (!(await file.exists())) {
        console.error(`[Dashboard] File not found: ${filePath}`);
        set.status = 404;
        return new Response("File not found", { status: 404 });
      }
      set.headers["Cache-Control"] = "no-cache";
      return file;
    } catch (error) {
      console.error("[Dashboard] Error serving login.js:", error);
      set.status = 500;
      return new Response("Internal Server Error", { status: 500 });
    }
  })
  .get("/dashboard/styles.css", async ({ set }) => {
    try {
      const filePath = join(ROOT_DIR, "dashboard", "styles.css");
      const file = Bun.file(filePath);
      if (!(await file.exists())) {
        console.error(`[Dashboard] File not found: ${filePath}`);
        set.status = 404;
        return new Response("File not found", { status: 404 });
      }
      set.headers["Cache-Control"] = "no-cache";
      return file;
    } catch (error) {
      console.error("[Dashboard] Error serving styles.css:", error);
      set.status = 500;
      return new Response("Internal Server Error", { status: 500 });
    }
  })
  // Protected dashboard routes (require authentication)
  // Elysia automatically handles HEAD requests when returning Bun.file()
  .use(requireDashboardAuth())
  .get("/dashboard", async ({ set }) => {
    try {
      const filePath = join(ROOT_DIR, "dashboard", "index.html");
      const file = Bun.file(filePath);
      if (!(await file.exists())) {
        console.error(`[Dashboard] File not found: ${filePath}`);
        set.status = 404;
        return new Response("File not found", { status: 404 });
      }
      set.headers["Cache-Control"] = "no-cache";
      return file;
    } catch (error) {
      console.error("[Dashboard] Error serving index.html:", error);
      set.status = 500;
      return new Response("Internal Server Error", { status: 500 });
    }
  })
  .get("/dashboard/*", async ({ params, set }) => {
    try {
      const relativePath = (params as any)["*"] || "";
      const filePath = join(ROOT_DIR, "dashboard", relativePath);
      const file = Bun.file(filePath);
      if (!(await file.exists())) {
        console.error(`[Dashboard] File not found: ${filePath}`);
        set.status = 404;
        return new Response("File not found", { status: 404 });
      }
      set.headers["Cache-Control"] = "no-cache";
      return file;
    } catch (error) {
      console.error(`[Dashboard] Error serving file: ${(params as any)["*"]}`, error);
      set.status = 404;
      return new Response("File not found", { status: 404 });
    }
  })

  // Start server
  .listen(
    {
      port: Number(PORT),
      hostname: "0.0.0.0", // Bind to all interfaces for Railway/Docker
      maxRequestBodySize: 100 * 1024 * 1024, // 100MB limit
      development: process.env.NODE_ENV !== "production",
    },
    ({ hostname, port }) => {
      console.log(`\n[Server] ✅ Elysia server started successfully!`);
      console.log(`[Server] Listening on http://${hostname}:${port}`);
      console.log(`[Server] Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`[Server] PORT env var: ${process.env.PORT}\n`);
    }
  );

// Determine base URL for logging (Railway or local)
const BASE_URL = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : process.env.RAILWAY_STATIC_URL ||
    process.env.CDN_URL ||
    `http://0.0.0.0:${PORT}`;

// Startup banner
console.log("\n" + "=".repeat(70));
console.log("🚀 ASSET-FORGE CDN v2.0");
console.log("=".repeat(70));
console.log(`✅ Server ready at ${BASE_URL}`);
console.log(`📊 Health: ${BASE_URL}/api/health`);
console.log(`📚 Docs: ${BASE_URL}/swagger`);
console.log("=".repeat(70) + "\n");

// Export app for type inference
export type App = typeof app;
export { app };