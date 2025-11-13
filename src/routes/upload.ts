/**
 * File Upload Route
 * Handles multipart form data uploads with TypeBox validation
 * Protected by API key authentication and strict rate limiting
 * Fires webhook to Asset-Forge app after successful uploads
 */

import { Elysia } from "elysia";
import { join, dirname } from "path";
import { existsSync, mkdirSync } from "fs";
import { UploadRequestBody, UploadResponse } from "../types/models";
import { requireApiKey } from "../middleware/auth";
import { uploadRateLimit } from "../middleware/rateLimit";
import {
  sendWebhookWithRetry,
  extractAssetId,
} from "../utils/webhook";

export function createUploadRoute(rootDir: string) {
  // Webhook configuration from environment
  const webhookEnabled = process.env.ENABLE_WEBHOOK === "true";
  const assetForgeApiUrl = process.env.ASSET_FORGE_API_URL;
  const webhookSecret = process.env.WEBHOOK_SECRET;
  const retryAttempts = parseInt(
    process.env.WEBHOOK_RETRY_ATTEMPTS || "3",
    10,
  );
  const retryDelay = parseInt(process.env.WEBHOOK_RETRY_DELAY_MS || "1000", 10);
  const timeout = parseInt(process.env.WEBHOOK_TIMEOUT_MS || "5000", 10);

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
      // Fire webhook after response sent (non-blocking)
      .onAfterResponse(async ({ set, path, request }) => {
        // Only fire webhook for successful uploads
        if (path !== "/api/upload" || set.status !== 200) {
          return;
        }

        // Check if webhook is enabled
        if (!webhookEnabled || !assetForgeApiUrl) {
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
                `[Webhook] Could not extract asset ID from path: ${file.path}`,
              );
              continue;
            }

            if (!assetGroups.has(assetId)) {
              assetGroups.set(assetId, []);
            }
            assetGroups.get(assetId)!.push(file);
          }

          // Fire webhook for each asset group
          const cdnBaseUrl = process.env.CDN_URL || (() => {
            if (process.env.NODE_ENV === 'production') {
              throw new Error('CDN_URL must be set in production environment');
            }
            return `http://0.0.0.0:${process.env.PORT || 3005}`;
          })();

          for (const [assetId, files] of assetGroups.entries()) {
            const payload = {
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
              `[Webhook] Firing webhook for asset ${assetId} (${files.length} files)`,
            );

            // Send webhook with retry logic (fire-and-forget)
            sendWebhookWithRetry(`${assetForgeApiUrl}/api/cdn/webhook/upload`, payload, {
              secret: webhookSecret,
              retryAttempts,
              retryDelay,
              timeout,
            }).catch((error) => {
              // Log but don't throw - webhook failures shouldn't affect upload
              console.error(
                `[Webhook] Failed to send webhook for asset ${assetId}:`,
                error instanceof Error ? error.message : String(error),
              );
            });
          }
        } catch (error) {
          // Log but don't throw - webhook failures shouldn't affect upload
          console.error(
            "[Webhook] Error processing webhook:",
            error instanceof Error ? error.message : String(error),
          );
        }
      })
  );
}
