import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { healthCheck } from "./endpoints/health";

import { googleAuthStart, googleAuthCallback } from "./auth/realoauth";
import { validateSession, getMe } from "./auth/oauth";
import { gmailSyncReal } from "./gmail/syncreal";
import { getEmails, getEmailById, getEmailStats } from "./gmail/getemails";
import { filterEmail } from "./emails/filter";
import { getInsuranceSummary } from "./insurance/summary";
import { getEnvironmentProfile } from "./agent/environment";
import { corsHeaders, checkRateLimit, getSupabaseClient } from "./utils/supabase";

// Helper to validate session (shared across MCP endpoints)
async function validateSessionAndGetUserId(sessionToken: string): Promise<string> {
  const SUPABASE_URL = process.env.SUPABASE_URL!;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = getSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("*")
    .eq("session_token", sessionToken)
    .single();

  if (sessionError || !session) {
    throw new Error("Invalid session token");
  }

  if (new Date(session.expires_at) < new Date()) {
    throw new Error("Session expired");
  }

  return session.user_id;
}

// Helper: MCP rate limit check (20 requests per minute per user)
async function checkMcpRateLimit(userId: string): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const SUPABASE_URL = process.env.SUPABASE_URL!;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = getSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  return checkRateLimit(supabase, userId, "/mcp", 20, 1);
}

// MCP HTTP Actions
const mcpPersona = httpAction(async (ctx: any, request: Request) => {
  try {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request, "POST, OPTIONS") });
    }

    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed, use POST" }),
        { status: 405, headers: { "Content-Type": "application/json", ...corsHeaders(request) } }
      );
    }

    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders(request) } }
      );
    }
    const sessionToken = authHeader.substring(7);
    const user_id = await validateSessionAndGetUserId(sessionToken);

    const rateCheck = await checkMcpRateLimit(user_id);
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({ error: "Too many requests", retryAfterSeconds: rateCheck.retryAfterSeconds }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders(request) } }
      );
    }

    const result = await ctx.runAction(internal.mcp.personaAction.personaGeneratorAction, { userId: user_id });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders(request) },
    });
  } catch (error) {
    const errorMessage = String(error);
    console.error(`[MCP Persona] Error: ${errorMessage}`);
    return new Response(
      JSON.stringify({ error: "Persona generation failed", details: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders(request) } }
    );
  }
});

const mcpPolicy = httpAction(async (ctx: any, request: Request) => {
  try {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request, "POST, OPTIONS") });
    }

    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed, use POST" }),
        { status: 405, headers: { "Content-Type": "application/json", ...corsHeaders(request) } }
      );
    }

    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders(request) } }
      );
    }
    const sessionToken = authHeader.substring(7);
    const user_id = await validateSessionAndGetUserId(sessionToken);

    const rateCheck = await checkMcpRateLimit(user_id);
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({ error: "Too many requests", retryAfterSeconds: rateCheck.retryAfterSeconds }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders(request) } }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { email_id } = body as { email_id?: string };

    const result = await ctx.runAction(internal.mcp.policyAnalyzer.policyAnalyzerAction, { userId: user_id, emailId: email_id });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders(request) },
    });
  } catch (error) {
    const errorMessage = String(error);
    console.error(`[MCP Policy] Error: ${errorMessage}`);
    return new Response(
      JSON.stringify({ error: "Policy analysis failed", details: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders(request) } }
    );
  }
});

const mcpRisk = httpAction(async (ctx: any, request: Request) => {
  try {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request, "POST, OPTIONS") });
    }

    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed, use POST" }),
        { status: 405, headers: { "Content-Type": "application/json", ...corsHeaders(request) } }
      );
    }

    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders(request) } }
      );
    }
    const sessionToken = authHeader.substring(7);
    const user_id = await validateSessionAndGetUserId(sessionToken);

    const rateCheck = await checkMcpRateLimit(user_id);
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({ error: "Too many requests", retryAfterSeconds: rateCheck.retryAfterSeconds }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders(request) } }
      );
    }

    const result = await ctx.runAction(internal.mcp.riskAssessment.riskAssessmentAction, { userId: user_id });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders(request) },
    });
  } catch (error) {
    const errorMessage = String(error);
    console.error(`[MCP Risk] Error: ${errorMessage}`);
    return new Response(
      JSON.stringify({ error: "Risk assessment failed", details: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders(request) } }
    );
  }
});

const mcpRecommend = httpAction(async (ctx: any, request: Request) => {
  try {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request, "POST, OPTIONS") });
    }

    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed, use POST" }),
        { status: 405, headers: { "Content-Type": "application/json", ...corsHeaders(request) } }
      );
    }

    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders(request) } }
      );
    }
    const sessionToken = authHeader.substring(7);
    const user_id = await validateSessionAndGetUserId(sessionToken);

    const rateCheck = await checkMcpRateLimit(user_id);
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({ error: "Too many requests", retryAfterSeconds: rateCheck.retryAfterSeconds }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders(request) } }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { context } = body as { context?: string };

    const result = await ctx.runAction(internal.mcp.recommendationEngine.recommendationEngineAction, { userId: user_id, context });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders(request) },
    });
  } catch (error) {
    const errorMessage = String(error);
    console.error(`[MCP Recommend] Error: ${errorMessage}`);
    return new Response(
      JSON.stringify({ error: "Recommendation generation failed", details: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders(request) } }
    );
  }
});

const mcpChat = httpAction(async (ctx: any, request: Request) => {
  try {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request, "POST, OPTIONS") });
    }

    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed, use POST" }),
        { status: 405, headers: { "Content-Type": "application/json", ...corsHeaders(request) } }
      );
    }

    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders(request) } }
      );
    }
    const sessionToken = authHeader.substring(7);
    const user_id = await validateSessionAndGetUserId(sessionToken);

    const rateCheck = await checkMcpRateLimit(user_id);
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({ error: "Too many requests", retryAfterSeconds: rateCheck.retryAfterSeconds }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders(request) } }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { message, history } = body as {
      message: string;
      history?: Array<{ role: string; content: string }>;
    };

    if (!message) {
      return new Response(
        JSON.stringify({ error: "Missing message" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders(request) } }
      );
    }

    const result = await ctx.runAction(internal.mcp.conversationSimulator.conversationSimulatorAction, { userId: user_id, userMessage: message, conversationHistory: history });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders(request) },
    });
  } catch (error) {
    const errorMessage = String(error);
    console.error(`[MCP Chat] Error: ${errorMessage}`);
    return new Response(
      JSON.stringify({ error: "Conversation simulation failed", details: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders(request) } }
    );
  }
});

const http = httpRouter();

// Health check
http.route({
  path: "/health",
  method: "GET",
  handler: healthCheck,
});

// Auth endpoints
http.route({
  path: "/auth/google",
  method: "GET",
  handler: googleAuthStart,
});

http.route({
  path: "/auth/google/callback",
  method: "GET",
  handler: googleAuthCallback,
});

http.route({
  path: "/auth/session",
  method: "GET",
  handler: validateSession,
});

http.route({
  path: "/me",
  method: "GET",
  handler: getMe,
});

http.route({
  path: "/me",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, request) => {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request, "GET, OPTIONS"),
    });
  }),
});

// Gmail endpoints
http.route({
  path: "/gmail/sync",
  method: "POST",
  handler: gmailSyncReal,
});

http.route({
  path: "/gmail/sync",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, request) => {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request, "POST, OPTIONS"),
    });
  }),
});

http.route({
  path: "/gmail/emails",
  method: "GET",
  handler: getEmails,
});

http.route({
  path: "/gmail/emails/:messageId",
  method: "GET",
  handler: getEmailById,
});

http.route({
  path: "/gmail/stats",
  method: "GET",
  handler: getEmailStats,
});

// Email filtering
http.route({
  path: "/emails/filter",
  method: "POST",
  handler: filterEmail,
});

// Insurance analysis
http.route({
  path: "/insurance/summary",
  method: "GET",
  handler: getInsuranceSummary,
});

// Environment agent
http.route({
  path: "/agent/environment",
  method: "GET",
  handler: getEnvironmentProfile,
});

// MCP Endpoints
http.route({ path: "/mcp/persona", method: "POST", handler: mcpPersona });
http.route({ path: "/mcp/persona", method: "OPTIONS", handler: mcpPersona });
http.route({ path: "/mcp/policy", method: "POST", handler: mcpPolicy });
http.route({ path: "/mcp/policy", method: "OPTIONS", handler: mcpPolicy });
http.route({ path: "/mcp/risk", method: "POST", handler: mcpRisk });
http.route({ path: "/mcp/risk", method: "OPTIONS", handler: mcpRisk });
http.route({ path: "/mcp/recommend", method: "POST", handler: mcpRecommend });
http.route({ path: "/mcp/recommend", method: "OPTIONS", handler: mcpRecommend });
http.route({ path: "/mcp/chat", method: "POST", handler: mcpChat });
http.route({ path: "/mcp/chat", method: "OPTIONS", handler: mcpChat });

export default http;
