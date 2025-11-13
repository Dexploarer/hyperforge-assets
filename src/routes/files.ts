/**
 * Files Management Route
 * List files and delete individual files
 */

import { Elysia } from "elysia";
import { join, normalize } from "path";
import { existsSync, unlinkSync } from "fs";
import { AssetsListResponse, DeleteResponse } from "../types/models";
import { getAllFiles, toRelativePaths } from "../utils/file-helpers";
import { requireApiKey } from "../middleware/auth";

export function createFilesRoute(rootDir: string, assetDirs: string[]) {
  return new Elysia({ prefix: "/api", name: "files" })
    // GET /api/files - List all files with metadata
    .get(
      "/files",
      () => {
        const files: any[] = [];

        // Collect files from all asset directories
        assetDirs.forEach((dir) => {
          const dirPath = join(rootDir, dir);
          try {
            const dirFiles = getAllFiles(dirPath);
            // Convert to relative paths for API response
            const relativFiles = toRelativePaths(dirFiles, rootDir);
            files.push(...relativFiles);
          } catch (err) {
            console.error(`[Files] Error listing ${dir}:`, err);
          }
        });

        return { files };
      },
      {
        response: AssetsListResponse,
        detail: {
          tags: ["Files"],
          summary: "List all files",
          description:
            "Returns all files in the CDN with metadata (path, size, modified date, type)",
        },
      }
    )

    // DELETE /api/delete/:path - Delete a specific file (requires auth)
    .use(requireApiKey())
    .delete(
      "/delete/:path",
      async ({ params, set }) => {
        try {
          const filePath = decodeURIComponent((params as any).path);

          // Security: Validate path doesn't escape root directory
          if (
            filePath.includes("..") ||
            filePath.startsWith("/") ||
            filePath.includes("\\")
          ) {
            set.status = 400;
            return {
              success: false,
              error: "Invalid file path",
            };
          }

          // Construct absolute path
          const absolutePath = normalize(join(rootDir, filePath));

          // Ensure the resolved path is still within rootDir
          if (!absolutePath.startsWith(rootDir)) {
            set.status = 400;
            return {
              success: false,
              error: "Invalid file path - outside root directory",
            };
          }

          // Check if file exists
          if (!existsSync(absolutePath)) {
            set.status = 404;
            return {
              success: false,
              error: "File not found",
            };
          }

          // Delete the file
          unlinkSync(absolutePath);

          console.log(`[Files] Deleted file: ${filePath}`);

          return {
            success: true,
          };
        } catch (error) {
          console.error("[Files] Delete error:", error);
          set.status = 500;
          return {
            success: false,
            error:
              error instanceof Error ? error.message : "Unknown delete error",
          };
        }
      },
      {
        response: DeleteResponse,
        detail: {
          tags: ["Files"],
          summary: "Delete a file (Auth Required)",
          description:
            "Deletes a specific file from the CDN. Requires API key authentication. Path should be relative to CDN root.",
          security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }],
        },
      }
    );
}
