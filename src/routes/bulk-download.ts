/**
 * Bulk Download Route
 * Creates ZIP archives of multiple files for download
 */

import { Elysia } from "elysia";
import { join, normalize, basename } from "path";
import { existsSync } from "fs";
import JSZip from "jszip";
import { BulkDownloadRequestBody } from "../types/models";
import { requireApiKey } from "../middleware/auth";

export function createBulkDownloadRoute(rootDir: string) {
  return (
    new Elysia({ prefix: "/api", name: "bulk-download" })
      // Apply authentication
      .use(requireApiKey())

      // POST /api/bulk-download - Create ZIP of selected files
      .post(
        "/bulk-download",
        async ({ body, set }) => {
          try {
            const { filePaths } = body;

            if (!filePaths || filePaths.length === 0) {
              set.status = 400;
              return new Response(
                JSON.stringify({ error: "No files specified" }),
                { status: 400 }
              );
            }

            console.log(
              `[BulkDownload] Creating ZIP with ${filePaths.length} file(s)`
            );

            // Create new JSZip instance
            const zip = new JSZip();
            let filesAdded = 0;
            let filesFailed = 0;

            // Add each file to the ZIP
            for (const filePath of filePaths) {
              try {
                // Security: Validate path
                if (
                  filePath.includes("..") ||
                  filePath.startsWith("/") ||
                  filePath.includes("\\")
                ) {
                  console.warn(
                    `[BulkDownload] Skipping invalid path: ${filePath}`
                  );
                  filesFailed++;
                  continue;
                }

                // Construct absolute path
                const absolutePath = normalize(join(rootDir, filePath));

                // Ensure path is within rootDir
                if (!absolutePath.startsWith(rootDir)) {
                  console.warn(
                    `[BulkDownload] Skipping path outside root: ${filePath}`
                  );
                  filesFailed++;
                  continue;
                }

                // Check if file exists
                if (!existsSync(absolutePath)) {
                  console.warn(`[BulkDownload] File not found: ${filePath}`);
                  filesFailed++;
                  continue;
                }

                // Read file using Bun.file()
                const file = Bun.file(absolutePath);
                const arrayBuffer = await file.arrayBuffer();

                // Add file to ZIP with relative path
                // This preserves the directory structure
                zip.file(filePath, arrayBuffer);
                filesAdded++;

                console.log(`[BulkDownload] Added: ${filePath}`);
              } catch (err) {
                console.error(
                  `[BulkDownload] Error adding ${filePath}:`,
                  err
                );
                filesFailed++;
              }
            }

            // Check if any files were added
            if (filesAdded === 0) {
              set.status = 404;
              return new Response(
                JSON.stringify({
                  error: "No valid files found to download",
                }),
                { status: 404 }
              );
            }

            console.log(
              `[BulkDownload] ZIP complete: ${filesAdded} added, ${filesFailed} failed`
            );

            // Generate ZIP file as blob
            const zipBlob = await zip.generateAsync({
              type: "blob",
              compression: "DEFLATE",
              compressionOptions: { level: 6 },
            });

            // Create timestamp for filename
            const timestamp = new Date()
              .toISOString()
              .replace(/[:.]/g, "-")
              .slice(0, 19);
            const filename = `hyperscape-assets-${timestamp}.zip`;

            // Set response headers for download
            set.headers["Content-Type"] = "application/zip";
            set.headers[
              "Content-Disposition"
            ] = `attachment; filename="${filename}"`;
            set.headers["Content-Length"] = String(zipBlob.size);

            // Convert blob to array buffer for Bun Response
            const arrayBuffer = await zipBlob.arrayBuffer();

            return new Response(arrayBuffer, {
              headers: {
                "Content-Type": "application/zip",
                "Content-Disposition": `attachment; filename="${filename}"`,
                "Content-Length": String(zipBlob.size),
              },
            });
          } catch (error) {
            console.error("[BulkDownload] Error:", error);
            set.status = 500;
            return new Response(
              JSON.stringify({
                error:
                  error instanceof Error
                    ? error.message
                    : "Unknown bulk download error",
              }),
              { status: 500 }
            );
          }
        },
        {
          body: BulkDownloadRequestBody,
          detail: {
            tags: ["Bulk Operations"],
            summary: "Bulk download files as ZIP (Auth Required)",
            description:
              "Creates a ZIP archive of multiple files and returns it for download. Requires API key authentication. Files are validated for security and must exist within the CDN root directory.",
            security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }],
          },
        }
      )
  );
}
