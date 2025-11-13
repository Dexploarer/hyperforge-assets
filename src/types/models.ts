/**
 * TypeBox Models for API Validation
 * Elysia uses TypeBox for runtime validation and type inference
 */

import { t } from "elysia";

// Health Check Response
export const HealthResponse = t.Object({
  status: t.String(),
  timestamp: t.String(),
  cdn: t.Optional(t.String()),
});

// File Metadata
export const FileMetadata = t.Object({
  path: t.String(),
  name: t.String(),
  size: t.Number(),
  modified: t.String(),
  type: t.String(),
});

// Assets List Response
export const AssetsListResponse = t.Object({
  files: t.Array(FileMetadata),
});

// Upload Request Body
export const UploadRequestBody = t.Object({
  files: t.Files({
    maxSize: "100m",
    // Allow GLB models, images, JSON metadata
    type: ["model/gltf-binary", "image/*", "application/json", "text/plain"],
  }),
  directory: t.Optional(t.String()),
});

// Upload Response
export const UploadResponse = t.Object({
  success: t.Boolean(),
  files: t.Optional(
    t.Array(
      t.Object({
        name: t.String(),
        size: t.Number(),
        path: t.String(),
      })
    )
  ),
  error: t.Optional(t.String()),
});

// Error Response
export const ErrorResponse = t.Object({
  error: t.String(),
  message: t.String(),
  details: t.Optional(t.String()),
});
