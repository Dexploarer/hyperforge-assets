/**
 * File Upload Route
 * Handles multipart form data uploads with TypeBox validation
 * Protected by API key authentication and strict rate limiting
 */

import { Elysia } from "elysia";
import { join, dirname } from "path";
import { existsSync, mkdirSync } from "fs";
import { UploadRequestBody, UploadResponse } from "../types/models";
import { requireApiKey } from "../middleware/auth";
import { uploadRateLimit } from "../middleware/rateLimit";

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
            const { files, directory } = body;
            const targetDir = directory || "models";
            const uploadedFiles: {
              name: string;
              size: number;
              path: string;
            }[] = [];

            // Handle array of files
            const fileArray = Array.isArray(files) ? files : [files];

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
  );
}
