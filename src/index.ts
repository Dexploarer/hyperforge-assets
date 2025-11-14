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
import { logger } from "@bogeychan/elysia-logger";
import pino from "pino";

// Configuration
import { pinoConfig } from "./config/logger";

// Middleware and plugins
import { errorHandler } from "./middleware/errorHandler";
import { gracefulShutdown } from "./plugins/graceful-shutdown";
import { compression } from "./middleware/compression";
import { securityHeaders } from "./middleware/security";
import { apiRateLimit, staticFileRateLimit } from "./middleware/rateLimit";
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
const DATA_DIR = process.env.DATA_DIR || ROOT_DIR;
const PORT = process.env.PORT || 3005;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

// Asset directories to serve
const ASSET_DIRS = ["models", "emotes", "music"];

// Create Elysia app
const app = new Elysia()
  // Graceful shutdown handler
  .use(gracefulShutdown)

  // Logging middleware - high-performance structured logging with Pino
  .use(
    logger({
      level: pinoConfig.level,
      serializers: pinoConfig.serializers,
      transport: pinoConfig.transport,
      base: pinoConfig.base,
      timestamp: pinoConfig.timestamp,
      formatters: pinoConfig.formatters,
      autoLogging: {
        ignore: (ctx) => {
          // Don't log health checks to reduce noise
          const url = new URL(ctx.request.url);
          return (
            url.pathname === "/api/health" ||
            url.pathname === "/api/health/ready"
          );
        },
      },
    }),
  )

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
  .use(compression)

  // Rate limiting for API endpoints (exclude static files)
  .use(apiRateLimit)

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
  .use(staticFileRateLimit)

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
  .get("/dashboard/login", ({ set }) => {
    set.headers["Content-Type"] = "text/html";
    set.headers["Cache-Control"] = "no-cache";
    return Bun.file(join(ROOT_DIR, "dashboard", "login.html"));
  })
  .head("/dashboard/login", ({ set }) => {
    set.headers["Content-Type"] = "text/html";
    set.headers["Cache-Control"] = "no-cache";
    set.headers["Content-Length"] = "4704";
    return new Response(null, { status: 200 });
  })
  .get("/dashboard/login.html", ({ set }) => {
    try {
      const filePath = join(ROOT_DIR, "dashboard", "login.html");
      const file = Bun.file(filePath);
      set.headers["Content-Type"] = "text/html";
      set.headers["Cache-Control"] = "no-cache";
      return file;
    } catch (error) {
      console.error("[Dashboard] Error serving login.html:", error);
      set.status = 500;
      return new Response("Internal Server Error", { status: 500 });
    }
  })
  .head("/dashboard/login.html", ({ set }) => {
    set.headers["Content-Type"] = "text/html";
    set.headers["Cache-Control"] = "no-cache";
    set.headers["Content-Length"] = "4704";
    return new Response(null, { status: 200 });
  })
  .get("/dashboard/login.js", ({ set }) => {
    try {
      const filePath = join(ROOT_DIR, "dashboard", "login.js");
      const file = Bun.file(filePath);
      set.headers["Content-Type"] = "application/javascript";
      set.headers["Cache-Control"] = "no-cache";
      return file;
    } catch (error) {
      console.error("[Dashboard] Error serving login.js:", error);
      set.status = 500;
      return new Response("Internal Server Error", { status: 500 });
    }
  })
  .head("/dashboard/login.js", ({ set }) => {
    set.headers["Content-Type"] = "application/javascript";
    set.headers["Cache-Control"] = "no-cache";
    set.headers["Content-Length"] = "3237";
    return new Response(null, { status: 200 });
  })
  .get("/dashboard/styles.css", ({ set }) => {
    set.headers["Content-Type"] = "text/css";
    set.headers["Cache-Control"] = "no-cache";
    return Bun.file(join(ROOT_DIR, "dashboard", "styles.css"));
  })
  .head("/dashboard/styles.css", ({ set }) => {
    set.headers["Content-Type"] = "text/css";
    set.headers["Cache-Control"] = "no-cache";
    set.headers["Content-Length"] = "11980";
    return new Response(null, { status: 200 });
  })
  // Protected dashboard routes (require authentication)
  .use(requireDashboardAuth())
  .get("/dashboard", ({ set }) => {
    set.headers["Content-Type"] = "text/html";
    set.headers["Cache-Control"] = "no-cache";
    return Bun.file(join(ROOT_DIR, "dashboard", "index.html"));
  })
  .get("/dashboard/*", ({ params, set }) => {
    const relativePath = (params as any)["*"] || "";
    const filePath = join(ROOT_DIR, "dashboard", relativePath);
    set.headers["Cache-Control"] = "no-cache";
    return Bun.file(filePath);
  })

  // Start server
  .listen({
    port: Number(PORT),
    hostname: "0.0.0.0", // Bind to all interfaces for Railway/Docker
    maxRequestBodySize: 100 * 1024 * 1024, // 100MB limit
    development: process.env.NODE_ENV !== "production",
  });

// Create a standalone Pino logger instance for startup logs
const startupLogger = pino(pinoConfig);

// Determine base URL for logging (Railway or local)
const BASE_URL = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : process.env.RAILWAY_STATIC_URL ||
    process.env.CDN_URL ||
    `http://0.0.0.0:${PORT}`;

// Startup banner - Visual for developers
if (process.env.NODE_ENV !== "production") {
  console.log("\n" + "=".repeat(70));
  console.log("🚀 ASSET-FORGE CDN v2.0 - ELYSIA + BUN");
  console.log("=".repeat(70));
  console.log("\n📍 SERVER ENDPOINTS:");
  console.log(`   🌐 Server:      ${BASE_URL}`);
  console.log(`   📊 Health:      ${BASE_URL}/api/health`);
  console.log(`   📚 API Docs:    ${BASE_URL}/swagger`);
  console.log(`   🎨 Assets:      ${BASE_URL}/api/assets`);
  console.log(`   📤 Upload:      ${BASE_URL}/api/upload`);
  console.log(`   🔌 WebSocket:   ${BASE_URL.replace("http", "ws")}/ws/events`);
  console.log(`   🖼️  Models:      ${BASE_URL}/models/`);
  console.log(`   ✨ Emotes:      ${BASE_URL}/emotes/`);
  console.log(`   🎵 Music:       ${BASE_URL}/music/`);
  console.log(`   🎛️  Dashboard:   ${BASE_URL}/dashboard`);
  console.log("\n🔧 CONFIGURATION:");
  console.log(`   📁 Data Dir:    ${DATA_DIR}`);
  console.log(`   🌍 CORS Origin: ${CORS_ORIGIN}`);
  console.log(`   🏗️  Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(
    `   🔐 Auth:        ${process.env.CDN_API_KEY ? "✅ Enabled" : "⚠️  Disabled"}`,
  );
  console.log("\n✨ FEATURES:");
  console.log("   ✅ Range Requests (audio/video streaming)");
  console.log("   ✅ ETag Support (304 conditional requests)");
  console.log("   ✅ Brotli/Gzip Compression");
  console.log("   ✅ Rate Limiting");
  console.log("   ✅ Security Headers");
  console.log("   ✅ API Key Authentication");
  console.log("   ✅ WebSocket Event Broadcasting");
  console.log("   ✅ Structured Logging (Pino)");
  console.log("\n" + "=".repeat(70));
  console.log("✅ CDN server ready!");
  console.log("=".repeat(70) + "\n");
}

// Structured startup log for production monitoring
startupLogger.info(
  {
    event: "server_started",
    version: "2.0.0",
    port: Number(PORT),
    hostname: "0.0.0.0",
    environment: process.env.NODE_ENV || "development",
    config: {
      dataDir: DATA_DIR,
      corsOrigin: CORS_ORIGIN,
      authEnabled: !!process.env.CDN_API_KEY,
      maxRequestBodySize: "100MB",
    },
    features: {
      rangeRequests: true,
      etagSupport: true,
      compression: true,
      rateLimiting: true,
      securityHeaders: true,
      apiKeyAuth: !!process.env.CDN_API_KEY,
      structuredLogging: true,
    },
    endpoints: {
      server: BASE_URL,
      health: `${BASE_URL}/api/health`,
      swagger: `${BASE_URL}/swagger`,
      assets: `${BASE_URL}/api/assets`,
    },
  },
  "Asset-Forge CDN started successfully",
);

// Export app for type inference
export type App = typeof app;
export { app };