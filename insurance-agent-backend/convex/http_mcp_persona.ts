import { httpAction } from "./_generated/server";
import { personaGenerator } from "./mcp/personaGenerator";

/**
 * MCP Endpoint: Persona Generator
 * POST /mcp/persona
 */
export const mcpPersonaHandler = httpAction(async (_ctx: any, request: Request) => {
  try {
    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed, use POST" }),
        { status: 405, headers: { "Content-Type": "application/json" } }
      );
    }

    const { user_id } = (await request.json()) as { user_id: string };

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "Missing user_id" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const result = await personaGenerator(user_id);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = String(error);
    console.error(`[MCP Persona] Error: ${errorMessage}`);

    return new Response(
      JSON.stringify({ error: "Persona generation failed", details: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
