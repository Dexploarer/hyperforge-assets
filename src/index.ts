/**
 * Asset-Forge CDN - Elysia TypeScript Server
 * High-performance CDN for serving stable game assets
 *
 * Features:
 * - Fast static file serving with Bun.file()
 * - Type-safe file uploads with TypeBox validation
 * - CORS enabled for cross-origin requests
 * - Swagger API documentation
 * - Kubernetes-ready health checks
 * - Graceful shutdown handling
 */

import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { join } from "path";

// Middleware and plugins
import { errorHandler } from "./middleware/errorHandler";
import { gracefulShutdown } from "./plugins/graceful-shutdown";

// Routes
import { healthRoutes } from "./routes/health";
import { createAssetsRoute } from "./routes/assets";
import { createUploadRoute } from "./routes/upload";

// Configuration from environment variables
const ROOT_DIR = process.cwd();
const DATA_DIR = process.env.DATA_DIR || ROOT_DIR;
const PORT = process.env.PORT || 3005;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

// Asset directories to serve
const ASSET_DIRS = ["models", "emotes"];

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
            "Elysia-powered CDN for serving and managing 3D game assets",
        },
        tags: [
          { name: "Health", description: "Health check endpoints" },
          { name: "Assets", description: "Asset listing and browsing" },
          { name: "Upload", description: "File upload management" },
        ],
      },
    })
  )

  // CORS configuration
  .use(
    cors({
      origin: CORS_ORIGIN,
      credentials: true,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  )

  // Error handling middleware
  .use(errorHandler)

  // API Routes
  .use(healthRoutes)
  .use(createAssetsRoute(ROOT_DIR, ASSET_DIRS))
  .use(createUploadRoute(ROOT_DIR))

  // Static file serving - models directory
  // Using Bun.file() pattern from asset-forge (more reliable than @elysiajs/static)
  .get("/models/*", async ({ params, set }) => {
    const relativePath = (params as any)["*"] || "";
    const filePath = join(ROOT_DIR, "models", relativePath);
    const file = Bun.file(filePath);

    if (!(await file.exists())) {
      set.status = 404;
      return new Response("File not found", { status: 404 });
    }

    // Immutable cache headers for CDN
    return new Response(file, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": file.type || "application/octet-stream",
      },
    });
  })
  .head("/models/*", async ({ params, set }) => {
    const relativePath = (params as any)["*"] || "";
    const filePath = join(ROOT_DIR, "models", relativePath);
    const file = Bun.file(filePath);

    if (!(await file.exists())) {
      set.status = 404;
      return new Response(null, { status: 404 });
    }

    return new Response(null, {
      status: 200,
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  })

  // Static file serving - emotes directory
  .get("/emotes/*", async ({ params, set }) => {
    const relativePath = (params as any)["*"] || "";
    const filePath = join(ROOT_DIR, "emotes", relativePath);
    const file = Bun.file(filePath);

    if (!(await file.exists())) {
      set.status = 404;
      return new Response("File not found", { status: 404 });
    }

    return new Response(file, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": file.type || "model/gltf-binary",
      },
    });
  })
  .head("/emotes/*", async ({ params, set }) => {
    const relativePath = (params as any)["*"] || "";
    const filePath = join(ROOT_DIR, "emotes", relativePath);
    const file = Bun.file(filePath);

    if (!(await file.exists())) {
      set.status = 404;
      return new Response(null, { status: 404 });
    }

    return new Response(null, {
      status: 200,
      headers: {
        "Content-Type": file.type || "model/gltf-binary",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  })

  // Start server
  .listen({
    port: Number(PORT),
    hostname: "0.0.0.0", // Bind to all interfaces for Railway/Docker
    maxRequestBodySize: 100 * 1024 * 1024, // 100MB limit
    development: process.env.NODE_ENV !== "production",
  });

// Startup banner
console.log("\n" + "=".repeat(60));
console.log("🚀 ASSET-FORGE CDN - ELYSIA + BUN");
console.log("=".repeat(60));
console.log("\n📍 SERVER ENDPOINTS:");
console.log(`   🌐 Server:      http://localhost:${PORT}`);
console.log(`   📊 Health:      http://localhost:${PORT}/api/health`);
console.log(`   📚 API Docs:    http://localhost:${PORT}/swagger`);
console.log(`   🎨 Assets:      http://localhost:${PORT}/api/assets`);
console.log(`   📤 Upload:      http://localhost:${PORT}/api/upload`);
console.log(`   🖼️  Models:      http://localhost:${PORT}/models/`);
console.log(`   ✨ Emotes:      http://localhost:${PORT}/emotes/`);
console.log("\n🔧 CONFIGURATION:");
console.log(`   📁 Data Dir:    ${DATA_DIR}`);
console.log(`   🌍 CORS Origin: ${CORS_ORIGIN}`);
console.log(`   🏗️  Environment: ${process.env.NODE_ENV || "development"}`);
console.log("\n" + "=".repeat(60));
console.log("✅ CDN server ready!");
console.log("=".repeat(60) + "\n");

// Export app for type inference
export type App = typeof app;
export { app };
