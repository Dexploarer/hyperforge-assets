/**
 * File Upload Route
 * Handles multipart form data uploads with TypeBox validation
 * Protected by API key authentication and strict rate limiting
 * Broadcasts upload events via WebSocket to connected API servers
 */

import { Elysia } from "elysia";
import { join, dirname } from "path";
import { existsSync, mkdirSync } from "fs";
import { UploadRequestBody, UploadResponse } from "../types/models";
import { requireApiKey } from "../middleware/auth";
import { uploadRateLimit } from "../middleware/rateLimit";
import { extractAssetId } from "../utils/webhook";

export function createUploadRoute(rootDir: string) {
  return (
    new Elysia({ prefix: "/api", name: "upload" })
      // Apply authentication (requires CDN_API_KEY env var)
      .use(requireApiKey())
      // Apply strict rate limiting (10 uploads per hour)
      .use(uploadRateLimit)
      .post(
        "/upload",
        async ({ body, set }) => {
          try {
            // Debug logging for troubleshooting
            console.log("[Upload] Request received");
            console.log("[Upload] Body keys:", Object.keys(body));
            console.log("[Upload] Files present:", !!body.files);
            console.log("[Upload] Directory:", body.directory || "models");

            const { files, directory } = body;
            const targetDir = directory || "models";
            const uploadedFiles: {
              name: string;
              size: number;
              path: string;
            }[] = [];

            // Handle array of files
            const fileArray = Array.isArray(files) ? files : [files];
            console.log("[Upload] Processing", fileArray.length, "file(s)");

            for (const file of fileArray) {
              if (file instanceof File) {
                const targetPath = join(rootDir, targetDir, file.name);

                // Ensure parent directory exists (create if needed)
                const targetDirPath = dirname(targetPath);
                if (!existsSync(targetDirPath)) {
                  mkdirSync(targetDirPath, { recursive: true });
                  console.log(`[Upload] Created directory: ${targetDirPath}`);
                }

                // Write file using Bun's native file API
                const buffer = await file.arrayBuffer();
                await Bun.write(targetPath, buffer);

                uploadedFiles.push({
                  name: file.name,
                  size: file.size,
                  path: join(targetDir, file.name),
                });

                console.log(
                  `[Upload] Saved file: ${file.name} (${file.size} bytes) to ${targetDir}`,
                );
              }
            }

            // Store uploaded files in context for webhook
            set.headers["x-uploaded-files"] = JSON.stringify(uploadedFiles);
            set.headers["x-upload-directory"] = targetDir;

            return {
              success: true,
              files: uploadedFiles,
            };
          } catch (error) {
            console.error("[Upload] Error:", error);
            set.status = 500;
            return {
              success: false,
              error:
                error instanceof Error ? error.message : "Unknown upload error",
            };
          }
        },
        {
          body: UploadRequestBody,
          response: UploadResponse,
          detail: {
            tags: ["Upload"],
            summary: "Upload files to CDN (Auth Required)",
            description:
              "Upload one or more files to the CDN. Requires API key authentication via Authorization header or X-API-Key header. Rate limited to 10 uploads per hour. Supports GLB models, images, JSON metadata, audio files. Maximum file size: 100MB per file.",
            security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }],
          },
        },
      )
      // Broadcast upload events via WebSocket after response sent (non-blocking)
      .onAfterResponse(async ({ set, path, server }) => {
        // Only broadcast for successful uploads
        if (path !== "/api/upload" || set.status !== 200) {
          return;
        }

        // Check if WebSocket server is available
        if (!server) {
          console.warn(
            "[WebSocket] Server not available for publishing events",
          );
          return;
        }

        try {
          // Extract uploaded files metadata from response headers
          const uploadedFilesHeader = set.headers["x-uploaded-files"];
          const uploadDirectory = set.headers["x-upload-directory"];

          if (!uploadedFilesHeader || !uploadDirectory) {
            return;
          }

          const uploadedFiles = JSON.parse(String(uploadedFilesHeader));

          // Group files by asset ID
          const assetGroups = new Map<
            string,
            Array<{ name: string; size: number; path: string }>
          >();

          for (const file of uploadedFiles) {
            const assetId = extractAssetId(file.path);
            if (!assetId) {
              console.warn(
                `[WebSocket] Could not extract asset ID from path: ${file.path}`,
              );
              continue;
            }

            if (!assetGroups.has(assetId)) {
              assetGroups.set(assetId, []);
            }
            assetGroups.get(assetId)!.push(file);
          }

          // Broadcast event for each asset group
          const cdnBaseUrl =
            process.env.CDN_URL ||
            (() => {
              if (process.env.NODE_ENV === "production") {
                throw new Error(
                  "CDN_URL must be set in production environment",
                );
              }
              return `http://0.0.0.0:${process.env.PORT || 3005}`;
            })();

          for (const [assetId, files] of assetGroups.entries()) {
            const event = {
              type: "asset-upload",
              assetId,
              directory: uploadDirectory,
              files: files.map((file) => ({
                name: file.name,
                size: file.size,
                relativePath: file.path,
                cdnUrl: `${cdnBaseUrl}/${file.path}`,
              })),
              uploadedAt: new Date().toISOString(),
              uploadedBy: null, // TODO: Extract from auth if available
            };

            console.log(
              `[WebSocket] Broadcasting upload event for asset ${assetId} (${files.length} files)`,
            );

            // Publish to cdn-uploads topic - all connected API servers will receive this
            server.publish("cdn-uploads", JSON.stringify(event));
          }
        } catch (error) {
          // Log but don't throw - event broadcast failures shouldn't affect upload
          console.error(
            "[WebSocket] Error broadcasting upload event:",
            error instanceof Error ? error.message : String(error),
          );
        }
      })
  );
}
