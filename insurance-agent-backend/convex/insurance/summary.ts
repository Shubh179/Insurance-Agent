import { httpAction } from "../_generated/server";
import { getSupabaseClient } from "../utils/supabase";
import { analyzeInsuranceEmails } from "../agents/insuranceAnalyzer";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing required Supabase environment variables");
}

const supabase = getSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Validate session and return user_id
 */
async function validateSessionAndGetUserId(sessionToken: string): Promise<string> {
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

/**
 * GET /insurance/summary
 * Analyze insurance-related emails from the last 1 year
 * Auth: Bearer <session_token>
 * Returns: InsuranceSummary with category breakdown
 */
export const getInsuranceSummary = httpAction(async (_ctx: any, request: Request) => {
  try {
    // Validate method
    if (request.method !== "GET") {
      return new Response(
        JSON.stringify({ error: "Method not allowed, use GET" }),
        { status: 405, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get session token from Authorization header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", details: "Missing or invalid Authorization header" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const sessionToken = authHeader.substring(7);

    console.log(`[InsuranceAPI] Fetching insurance summary`);

    // Validate session and get user_id
    const userId = await validateSessionAndGetUserId(sessionToken);
    console.log(`[InsuranceAPI] Session validated for user: ${userId}`);

    // Analyze insurance emails
    const summary = await analyzeInsuranceEmails(userId);

    return new Response(JSON.stringify({ status: "success", data: summary }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = String(error);

    if (errorMessage.includes("Invalid session token")) {
      console.error(`[InsuranceAPI] Invalid session: ${errorMessage}`);
      return new Response(
        JSON.stringify({ error: "Unauthorized", details: "Invalid session token" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    if (errorMessage.includes("Session expired")) {
      console.error(`[InsuranceAPI] Session expired: ${errorMessage}`);
      return new Response(
        JSON.stringify({ error: "Unauthorized", details: "Session expired, please login again" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    console.error(`[InsuranceAPI] Summary error: ${errorMessage}`);
    return new Response(
      JSON.stringify({
        error: "Failed to analyze insurance emails",
        details: errorMessage,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
