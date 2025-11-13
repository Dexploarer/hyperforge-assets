/**
 * File Upload Route
 * Handles multipart form data uploads with TypeBox validation
 */

import { Elysia } from "elysia";
import { join } from "path";
import { UploadRequestBody, UploadResponse } from "../types/models";

export function createUploadRoute(rootDir: string) {
  return new Elysia({ prefix: "/api", name: "upload" }).post(
    "/upload",
    async ({ body, set }) => {
      try {
        const { files, directory } = body;
        const targetDir = directory || "models";
        const uploadedFiles: { name: string; size: number; path: string }[] = [];

        // Handle array of files
        const fileArray = Array.isArray(files) ? files : [files];

        for (const file of fileArray) {
          if (file instanceof File) {
            const targetPath = join(rootDir, targetDir, file.name);

            // Write file using Bun's native file API
            const buffer = await file.arrayBuffer();
            await Bun.write(targetPath, buffer);

            uploadedFiles.push({
              name: file.name,
              size: file.size,
              path: join(targetDir, file.name),
            });

            console.log(
              `[Upload] Saved file: ${file.name} (${file.size} bytes) to ${targetDir}`
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
        summary: "Upload files to CDN",
        description:
          "Upload one or more files to the CDN. Supports GLB models, images, JSON metadata. Maximum file size: 100MB.",
      },
    }
  );
}
