/**
 * Management Route
 * Directory statistics, file rename, and bulk operations
 */

import { Elysia } from "elysia";
import { join, normalize, dirname, basename } from "path";
import { existsSync, unlinkSync, renameSync } from "fs";
import {
  DirectoryStatsResponse,
  RenameRequestBody,
  RenameResponse,
  BulkDeleteRequestBody,
  BulkDeleteResponse,
} from "../types/models";
import { getAllFiles } from "../utils/file-helpers";
import { requireApiKey } from "../middleware/auth";

export function createManagementRoute(rootDir: string, assetDirs: string[]) {
  return (
    new Elysia({ prefix: "/api", name: "management" })
      // GET /api/directories - Get directory statistics (public)
      .get(
        "/directories",
        () => {
          const directories = assetDirs.map((dir) => {
            const dirPath = join(rootDir, dir);
            try {
              const files = getAllFiles(dirPath);
              const totalSize = files.reduce((sum, file) => sum + file.size, 0);

              return {
                name: dir,
                fileCount: files.length,
                totalSize,
              };
            } catch (err) {
              console.error(`[Management] Error reading ${dir}:`, err);
              return {
                name: dir,
                fileCount: 0,
                totalSize: 0,
              };
            }
          });

          return { directories };
        },
        {
          response: DirectoryStatsResponse,
          detail: {
            tags: ["Management"],
            summary: "Get directory statistics",
            description:
              "Returns file count and total size for each asset directory",
          },
        }
      )

      // Apply authentication for all following routes
      .use(requireApiKey())

      // POST /api/rename - Rename a file
      .post(
        "/rename",
        async ({ body, set }) => {
          try {
            const { oldPath, newName } = body;

            // Validate new name doesn't contain path separators
            if (
              newName.includes("/") ||
              newName.includes("\\") ||
              newName.includes("..")
            ) {
              set.status = 400;
              return {
                success: false,
                error: "Invalid filename - cannot contain path separators",
              };
            }

            // Validate old path
            if (
              oldPath.includes("..") ||
              oldPath.startsWith("/") ||
              oldPath.includes("\\")
            ) {
              set.status = 400;
              return {
                success: false,
                error: "Invalid file path",
              };
            }

            // Construct paths
            const absoluteOldPath = normalize(join(rootDir, oldPath));
            const directory = dirname(absoluteOldPath);
            const absoluteNewPath = join(directory, newName);

            // Ensure paths are within rootDir
            if (
              !absoluteOldPath.startsWith(rootDir) ||
              !absoluteNewPath.startsWith(rootDir)
            ) {
              set.status = 400;
              return {
                success: false,
                error: "Invalid file path - outside root directory",
              };
            }

            // Check if old file exists
            if (!existsSync(absoluteOldPath)) {
              set.status = 404;
              return {
                success: false,
                error: "File not found",
              };
            }

            // Check if new file already exists
            if (existsSync(absoluteNewPath)) {
              set.status = 409;
              return {
                success: false,
                error: "A file with that name already exists",
              };
            }

            // Rename the file
            renameSync(absoluteOldPath, absoluteNewPath);

            console.log(
              `[Management] Renamed file: ${oldPath} -> ${newName}`
            );

            return {
              success: true,
              message: `Successfully renamed to ${newName}`,
            };
          } catch (error) {
            console.error("[Management] Rename error:", error);
            set.status = 500;
            return {
              success: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Unknown rename error",
            };
          }
        },
        {
          body: RenameRequestBody,
          response: RenameResponse,
          detail: {
            tags: ["Management"],
            summary: "Rename a file (Auth Required)",
            description:
              "Renames a file in the CDN. New name must not contain path separators. Requires API key authentication.",
            security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }],
          },
        }
      )

      // POST /api/bulk-delete - Delete multiple files
      .post(
        "/bulk-delete",
        async ({ body, set }) => {
          try {
            const { filePaths } = body;
            let deleted = 0;
            let failed = 0;

            for (const filePath of filePaths) {
              try {
                // Security: Validate path
                if (
                  filePath.includes("..") ||
                  filePath.startsWith("/") ||
                  filePath.includes("\\")
                ) {
                  console.warn(
                    `[Management] Skipping invalid path: ${filePath}`
                  );
                  failed++;
                  continue;
                }

                // Construct absolute path
                const absolutePath = normalize(join(rootDir, filePath));

                // Ensure path is within rootDir
                if (!absolutePath.startsWith(rootDir)) {
                  console.warn(
                    `[Management] Skipping path outside root: ${filePath}`
                  );
                  failed++;
                  continue;
                }

                // Check if file exists
                if (!existsSync(absolutePath)) {
                  console.warn(`[Management] File not found: ${filePath}`);
                  failed++;
                  continue;
                }

                // Delete the file
                unlinkSync(absolutePath);
                deleted++;
              } catch (err) {
                console.error(`[Management] Error deleting ${filePath}:`, err);
                failed++;
              }
            }

            console.log(
              `[Management] Bulk delete: ${deleted} deleted, ${failed} failed`
            );

            return {
              success: true,
              deleted,
              failed,
            };
          } catch (error) {
            console.error("[Management] Bulk delete error:", error);
            set.status = 500;
            return {
              success: false,
              deleted: 0,
              failed: 0,
              error:
                error instanceof Error
                  ? error.message
                  : "Unknown bulk delete error",
            };
          }
        },
        {
          body: BulkDeleteRequestBody,
          response: BulkDeleteResponse,
          detail: {
            tags: ["Management"],
            summary: "Bulk delete files (Auth Required)",
            description:
              "Deletes multiple files from the CDN in a single operation. Requires API key authentication. Returns count of successful and failed deletions.",
            security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }],
          },
        }
      )
  );
}
