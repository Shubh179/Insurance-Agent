import { httpAction } from "../_generated/server";

export const healthCheck = httpAction(async () => {
  try {
    const timestamp = Date.now();

    return new Response(
      JSON.stringify({
        status: "healthy",
        timestamp,
        service: "insurance-agent-backend",
        version: "0.1.0",
        environment: process.env.NODE_ENV || "development",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        status: "unhealthy",
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
});
