/**
 * Assets Listing Route
 * Returns all files in the asset directories with metadata
 */

import { Elysia } from "elysia";
import { join } from "path";
import { AssetsListResponse } from "../types/models";
import { getAllFiles, toRelativePaths } from "../utils/file-helpers";

export function createAssetsRoute(rootDir: string, assetDirs: string[]) {
  return new Elysia({ prefix: "/api", name: "assets" }).get(
    "/assets",
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
          console.error(`Error listing ${dir}:`, err);
        }
      });

      return { files };
    },
    {
      response: AssetsListResponse,
      detail: {
        tags: ["Assets"],
        summary: "List all assets",
        description:
          "Returns all files in the CDN with metadata (path, size, modified date, type)",
      },
    }
  );
}
