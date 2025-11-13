/**
 * Health Check Routes
 * Kubernetes-ready health checks with liveness and readiness probes
 */

import { Elysia } from "elysia";
import { HealthResponse } from "../types/models";

export const healthRoutes = new Elysia({ prefix: "/api", name: "health" })
  // Liveness check - "Am I alive?"
  // Used by Kubernetes to know if the container should be restarted
  .get(
    "/health/live",
    () => ({
      status: "ok",
      timestamp: new Date().toISOString(),
    }),
    {
      detail: {
        tags: ["Health"],
        summary: "Liveness probe",
        description:
          "Returns OK if server process is running (for Kubernetes liveness checks)",
      },
    }
  )

  // Readiness check - "Can I handle traffic?"
  // Used by Kubernetes to know if the pod should receive traffic
  .get(
    "/health/ready",
    ({ set }) => {
      // CDN is always ready if server is running
      // No external dependencies to check
      return {
        status: "ready",
        timestamp: new Date().toISOString(),
        cdn: "asset-forge-cdn",
      };
    },
    {
      detail: {
        tags: ["Health"],
        summary: "Readiness probe",
        description:
          "Returns ready if server can handle traffic (for Kubernetes readiness checks)",
      },
    }
  )

  // Legacy endpoint (keep for backward compatibility)
  .get(
    "/health",
    () => ({
      status: "healthy",
      timestamp: new Date().toISOString(),
      cdn: "asset-forge-cdn",
    }),
    {
      response: HealthResponse,
      detail: {
        tags: ["Health"],
        summary: "Legacy health check",
        description: "Basic health status (use /health/ready for Kubernetes)",
      },
    }
  );
