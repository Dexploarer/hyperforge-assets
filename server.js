/**
 * Asset-Forge CDN - Static Asset Server
 * Lightweight CDN for serving stable game assets
 */

import { join, extname, relative } from "path";
import { readdirSync, statSync } from "fs";

const ROOT_DIR = process.cwd();
const DATA_DIR = process.env.DATA_DIR || ROOT_DIR;
const PORT = process.env.PORT || 3005;

// Asset directories
const ASSET_DIRS = ["models"];

// CORS configuration
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": process.env.CORS_ORIGIN || "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Helper: Get all files recursively
function getAllFiles(dir, fileList = []) {
  try {
    const files = readdirSync(dir);
    files.forEach((file) => {
      const filePath = join(dir, file);
      try {
        const stat = statSync(filePath);
        if (stat.isDirectory()) {
          getAllFiles(filePath, fileList);
        } else {
          fileList.push({
            path: relative(ROOT_DIR, filePath),
            name: file,
            size: stat.size,
            modified: stat.mtime.toISOString(),
            type: extname(file),
          });
        }
      } catch (err) {
        console.error(`Error reading ${filePath}:`, err);
      }
    });
  } catch (err) {
    console.error(`Error reading directory ${dir}:`, err);
  }
  return fileList;
}

Bun.serve({
  port: PORT,
  async fetch(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    // API Routes
    if (pathname.startsWith("/api/")) {
      // Health check
      if (pathname === "/api/health" && request.method === "GET") {
        return new Response(
          JSON.stringify({
            status: "healthy",
            timestamp: new Date().toISOString(),
            cdn: "asset-forge-cdn",
          }),
          {
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          },
        );
      }

      // List all assets
      if (pathname === "/api/assets" && request.method === "GET") {
        const files = [];
        ASSET_DIRS.forEach((dir) => {
          const dirPath = join(ROOT_DIR, dir);
          try {
            getAllFiles(dirPath, files);
          } catch (err) {
            console.error(`Error listing ${dir}:`, err);
          }
        });

        return new Response(JSON.stringify({ files }), {
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      // Upload file
      if (pathname === "/api/upload" && request.method === "POST") {
        try {
          const formData = await request.formData();
          const files = formData.getAll("files");
          const targetDir = formData.get("directory") || "models";

          const uploadedFiles = [];

          for (const file of files) {
            if (file instanceof File) {
              const targetPath = join(ROOT_DIR, targetDir, file.name);

              // Write file
              const buffer = await file.arrayBuffer();
              await Bun.write(targetPath, buffer);

              uploadedFiles.push({
                name: file.name,
                size: file.size,
                path: join(targetDir, file.name),
              });
            }
          }

          return new Response(
            JSON.stringify({
              success: true,
              files: uploadedFiles,
            }),
            {
              headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
            },
          );
        } catch (error) {
          return new Response(
            JSON.stringify({
              success: false,
              error: error.message,
            }),
            {
              status: 500,
              headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
            },
          );
        }
      }

      return new Response("Not Found", {
        status: 404,
        headers: CORS_HEADERS,
      });
    }

    // Serve static files
    const filePath = join(ROOT_DIR, pathname);
    const file = Bun.file(filePath);

    if (await file.exists()) {
      const contentType = file.type || "application/octet-stream";
      return new Response(file, {
        headers: {
          ...CORS_HEADERS,
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    return new Response("Not Found", {
      status: 404,
      headers: CORS_HEADERS,
    });
  },
});

console.log("=".repeat(60));
console.log("🚀 ASSET-FORGE CDN");
console.log("=".repeat(60));
console.log(`📍 Server:     http://localhost:${PORT}`);
console.log(`🎨 Assets:     http://localhost:${PORT}/models`);
console.log(`📊 Health:     http://localhost:${PORT}/api/health`);
console.log(`📁 API:        http://localhost:${PORT}/api/assets`);
console.log("=".repeat(60));
