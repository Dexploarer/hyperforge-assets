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
    // No type validation - API key authentication provides security
    // Elysia's file type validation can be overly strict and inconsistent
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

// Auth Status Response
export const AuthStatusResponse = t.Object({
  authEnabled: t.Boolean(),
  authenticated: t.Boolean(),
});

// Directory Statistics
export const DirectoryStats = t.Object({
  name: t.String(),
  fileCount: t.Number(),
  totalSize: t.Number(),
});

export const DirectoryStatsResponse = t.Object({
  directories: t.Array(DirectoryStats),
});

// Delete Response
export const DeleteResponse = t.Object({
  success: t.Boolean(),
  error: t.Optional(t.String()),
});

// Rename Request & Response
export const RenameRequestBody = t.Object({
  oldPath: t.String(),
  newName: t.String(),
});

export const RenameResponse = t.Object({
  success: t.Boolean(),
  message: t.Optional(t.String()),
  error: t.Optional(t.String()),
});

// Bulk Delete Request & Response
export const BulkDeleteRequestBody = t.Object({
  filePaths: t.Array(t.String()),
});

export const BulkDeleteResponse = t.Object({
  success: t.Boolean(),
  deleted: t.Number(),
  failed: t.Number(),
  error: t.Optional(t.String()),
});

// Bulk Download Request
export const BulkDownloadRequestBody = t.Object({
  filePaths: t.Array(t.String()),
});

// Configuration Models (Read-Only)
export const ServerConfig = t.Object({
  port: t.Number(),
  host: t.String(),
});

export const CorsConfig = t.Object({
  allowedOrigins: t.Array(t.String()),
  allowedMethods: t.Array(t.String()),
  allowedHeaders: t.Array(t.String()),
});

export const DirectoriesConfig = t.Object({
  assets: t.Array(t.String()),
  upload: t.String(),
  backups: t.String(),
});

export const SecurityConfig = t.Object({
  maxFileSize: t.Number(),
  allowedFileTypes: t.Array(t.String()),
  enableAuth: t.Boolean(),
});

export const FeaturesConfig = t.Object({
  enableValidation: t.Boolean(),
  enableBackups: t.Boolean(),
  autoBackupInterval: t.Number(),
});

export const UIConfig = t.Object({
  theme: t.String(),
  itemsPerPage: t.Number(),
  defaultSort: t.String(),
});

export const ConfigResponse = t.Object({
  success: t.Boolean(),
  config: t.Object({
    server: ServerConfig,
    cors: CorsConfig,
    directories: DirectoriesConfig,
    security: SecurityConfig,
    features: FeaturesConfig,
    ui: UIConfig,
  }),
});
