import { httpAction } from "../_generated/server";
import { getSupabaseClient } from "../utils/supabase";

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
 * GET /gmail/emails
 * Retrieve stored emails for the authenticated user
 * Query params:
 *   - filter: 'all', 'insurance', 'spam' (default: 'all')
 *   - limit: number of emails to return (default: 50)
 *   - offset: pagination offset (default: 0)
 *   - sort: 'newest' or 'oldest' (default: 'newest')
 */
export const getEmails = httpAction(async (_ctx: any, request: Request) => {
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

    // Parse query parameters
    const url = new URL(request.url);
    const filter = url.searchParams.get("filter") || "all"; // 'all', 'insurance', 'spam'
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const sort = url.searchParams.get("sort") || "newest"; // 'newest' or 'oldest'

    console.log(`[Gmail] Fetching emails: filter=${filter}, limit=${limit}, offset=${offset}, sort=${sort}`);

    // Validate session and get user_id
    const userId = await validateSessionAndGetUserId(sessionToken);
    console.log(`[Gmail] Session validated for user: ${userId}`);

    // Build query
    let query = supabase
      .from("emails")
      .select("*")
      .eq("user_id", userId);

    // Apply filter
    if (filter === "insurance") {
      query = query.eq("is_insurance_related", true);
    } else if (filter === "spam") {
      query = query.eq("is_spam", true);
    }

    // Apply sorting
    const orderDirection = sort === "newest" ? "desc" : "asc";
    query = query.order("received_at", { ascending: orderDirection === "asc" });

    // Apply pagination
    const { data: emails, error: queryError, count } = await query
      .range(offset, offset + limit - 1)
      .order("received_at", { ascending: orderDirection === "asc" });

    if (queryError) {
      console.error(`[Gmail] Query error: ${queryError.message}`);
      return new Response(
        JSON.stringify({
          error: "Failed to fetch emails",
          details: queryError.message,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`[Gmail] Retrieved ${emails?.length || 0} emails for user ${userId}`);

    return new Response(
      JSON.stringify({
        status: "success",
        filter,
        limit,
        offset,
        sort,
        count: emails?.length || 0,
        totalCount: count || 0,
        emails: emails?.map((e) => ({
          id: e.id,
          gmailMessageId: e.gmail_message_id,
          sender: e.sender,
          subject: e.subject,
          rawSnippet: e.raw_snippet,
          isInsuranceRelated: e.is_insurance_related,
          isSpam: e.is_spam,
          category: e.category,
          receivedAt: e.received_at,
          fetchedAt: e.fetched_at,
          confidence: e.confidence,
          classifiedBy: e.classified_by,
        })) || [],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = String(error);

    if (errorMessage.includes("Invalid session token")) {
      console.error(`[Gmail] Invalid session: ${errorMessage}`);
      return new Response(
        JSON.stringify({ error: "Unauthorized", details: "Invalid session token" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    if (errorMessage.includes("Session expired")) {
      console.error(`[Gmail] Session expired: ${errorMessage}`);
      return new Response(
        JSON.stringify({ error: "Unauthorized", details: "Session expired, please login again" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    console.error(`[Gmail] Fetch emails error: ${errorMessage}`);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch emails",
        details: errorMessage,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

/**
 * GET /gmail/emails/:messageId
 * Retrieve a single email by message ID
 */
export const getEmailById = httpAction(async (_ctx: any, request: Request) => {
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

    // Extract message ID from URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/");
    const messageId = pathParts[pathParts.length - 1];

    if (!messageId) {
      return new Response(
        JSON.stringify({ error: "Bad request", details: "Message ID required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`[Gmail] Fetching email by ID: ${messageId}`);

    // Validate session and get user_id
    const userId = await validateSessionAndGetUserId(sessionToken);

    // Fetch email
    const { data: email, error: queryError } = await supabase
      .from("emails")
      .select("*")
      .eq("user_id", userId)
      .eq("gmail_message_id", messageId)
      .single();

    if (queryError || !email) {
      console.error(`[Gmail] Email not found: ${messageId}`);
      return new Response(
        JSON.stringify({
          error: "Not found",
          details: "Email not found",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        status: "success",
        email: {
          id: email.id,
          gmailMessageId: email.gmail_message_id,
          sender: email.sender,
          subject: email.subject,
          rawSnippet: email.raw_snippet,
          isInsuranceRelated: email.is_insurance_related,
          isSpam: email.is_spam,
          category: email.category,
          receivedAt: email.received_at,
          fetchedAt: email.fetched_at,
          confidence: email.confidence,
          classifiedBy: email.classified_by,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = String(error);

    if (errorMessage.includes("Invalid session token")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", details: "Invalid session token" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    if (errorMessage.includes("Session expired")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", details: "Session expired, please login again" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    console.error(`[Gmail] Fetch email error: ${errorMessage}`);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch email",
        details: errorMessage,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

/**
 * GET /gmail/stats
 * Get email statistics for the user
 */
export const getEmailStats = httpAction(async (_ctx: any, request: Request) => {
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

    console.log(`[Gmail] Fetching email statistics`);

    // Validate session and get user_id
    const userId = await validateSessionAndGetUserId(sessionToken);

    // Get all user emails
    const { data: allEmails, error: allError } = await supabase
      .from("emails")
      .select("*")
      .eq("user_id", userId);

    if (allError) {
      throw new Error(allError.message);
    }

    // Calculate statistics
    const total = allEmails?.length || 0;
    const insurance = allEmails?.filter((e) => e.is_insurance_related).length || 0;
    const spam = allEmails?.filter((e) => e.is_spam).length || 0;
    const other = total - insurance - spam;

    const oldestEmail = allEmails?.sort((a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime())[0];
    const newestEmail = allEmails?.sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime())[0];

    return new Response(
      JSON.stringify({
        status: "success",
        stats: {
          totalEmails: total,
          insuranceRelated: insurance,
          spam,
          other,
          oldestEmailDate: oldestEmail?.received_at,
          newestEmailDate: newestEmail?.received_at,
          percentageInsurance: total > 0 ? ((insurance / total) * 100).toFixed(2) : 0,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = String(error);

    if (errorMessage.includes("Invalid session token")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", details: "Invalid session token" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    if (errorMessage.includes("Session expired")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", details: "Session expired, please login again" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    console.error(`[Gmail] Stats error: ${errorMessage}`);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch statistics",
        details: errorMessage,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
