/**
 * Configuration Route (Read-Only)
 * Returns current server configuration for dashboard display
 */

import { Elysia } from "elysia";
import { join } from "path";
import { ConfigResponse } from "../types/models";

export function createConfigRoute(rootDir: string, assetDirs: string[]) {
  return new Elysia({ prefix: "/api", name: "config" }).get(
    "/config",
    () => {
      // Parse CORS origin
      const corsOrigin = process.env.CORS_ORIGIN || "*";
      const allowedOrigins =
        corsOrigin === "*" ? ["*"] : corsOrigin.split(",").map((o) => o.trim());

      return {
        success: true,
        config: {
          server: {
            port: parseInt(process.env.PORT || "3005", 10),
            host: process.env.HOST || "0.0.0.0",
          },
          cors: {
            allowedOrigins,
            allowedMethods: ["GET", "POST", "HEAD", "OPTIONS"],
            allowedHeaders: [
              "Content-Type",
              "Authorization",
              "X-API-Key",
              "Range",
              "If-None-Match",
              "If-Modified-Since",
            ],
          },
          directories: {
            assets: assetDirs,
            upload: rootDir,
            backups: join(rootDir, "backups"),
          },
          security: {
            maxFileSize: 100, // MB
            allowedFileTypes: [".glb", ".png", ".jpg", ".jpeg", ".json", ".mp3", ".wav", ".ogg"],
            enableAuth: !!process.env.CDN_API_KEY,
          },
          features: {
            enableValidation: false, // Not implemented yet
            enableBackups: false, // Not implemented yet
            autoBackupInterval: 24, // Hours (placeholder)
          },
          ui: {
            theme: "dark",
            itemsPerPage: 50,
            defaultSort: "name",
          },
        },
      };
    },
    {
      response: ConfigResponse,
      detail: {
        tags: ["Configuration"],
        summary: "Get current server configuration (Read-Only)",
        description:
          "Returns the current runtime configuration of the CDN server including server settings, CORS, directories, security settings, and UI preferences. This endpoint is read-only and does not support configuration updates.",
      },
    },
  );
}
