/**
 * Global Error Handler Middleware
 * Handles validation errors, not found, parse errors, and internal server errors
 * Uses structured logging with Pino for proper error tracking
 */

import { Elysia } from "elysia";
import pino from "pino";
import { pinoConfig } from "../config/logger";

// Create a dedicated logger for error handling
const errorLogger = pino({ ...pinoConfig, name: "error-handler" });

export const errorHandler = new Elysia({ name: "error-handler" }).onError(
  ({ code, error, set, request }) => {
    const url = new URL(request.url);

    // Handle Elysia validation errors
    if (code === "VALIDATION") {
      set.status = 400;

      errorLogger.warn({
        type: "validation_error",
        path: url.pathname,
        method: request.method,
        error: error instanceof Error ? error.message : String(error),
      }, "Validation error occurred");

      return {
        error: "VALIDATION_ERROR",
        message: "Validation failed",
        details:
          error && typeof error === "object" && "message" in error
            ? (error as Error).message
            : "Invalid request data",
      };
    }

    // Handle not found errors
    if (code === "NOT_FOUND") {
      set.status = 404;

      errorLogger.warn({
        type: "not_found",
        path: url.pathname,
        method: request.method,
      }, "Endpoint not found");

      return {
        error: "NOT_FOUND",
        message: "Endpoint not found",
      };
    }

    // Handle parse errors (invalid JSON, etc.)
    if (code === "PARSE") {
      set.status = 400;

      errorLogger.warn({
        type: "parse_error",
        path: url.pathname,
        method: request.method,
        error: error instanceof Error ? error.message : String(error),
      }, "Parse error occurred");

      return {
        error: "PARSE_ERROR",
        message: "Invalid request body format",
      };
    }

    // Handle all other errors as internal server errors
    set.status = 500;

    errorLogger.error({
      type: "internal_error",
      path: url.pathname,
      method: request.method,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : String(error),
    }, "Internal server error occurred");

    // Return safe error message to client in production
    return {
      error: "INTERNAL_SERVER_ERROR",
      message:
        process.env.NODE_ENV === "production"
          ? "An unexpected error occurred"
          : error && typeof error === "object" && "message" in error
            ? (error as Error).message
            : "Unknown error",
      // Include stack trace only in development
      ...(process.env.NODE_ENV !== "production" &&
        error instanceof Error && {
          stack: error.stack,
        }),
    };
  }
);
