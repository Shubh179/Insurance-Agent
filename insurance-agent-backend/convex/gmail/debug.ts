import { httpAction } from "../_generated/server";
import { getSupabaseClient } from "../utils/supabase";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase: any = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  supabase = getSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

const GMAIL_API_BASE = "https://www.googleapis.com/gmail/v1/users/me";

interface GmailMessage {
  id: string;
  snippet?: string;
  internalDate?: string;
  payload?: {
    headers?: { name: string; value: string }[];
  };
}

function getHeader(headers: { name: string; value: string }[] | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  const h = headers.find((h) => h.name?.toLowerCase() === name.toLowerCase());
  return h?.value;
}

/**
 * Debug endpoint to test Gmail sync step by step
 */
export const gmailSyncDebug = httpAction(async (_ctx: any, request: Request) => {
  try {
    console.log("[Gmail Debug] Starting...");

    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { "Content-Type": "application/json" } }
      );
    }

    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const sessionToken = authHeader.substring(7);
    console.log("[Gmail Debug] Session token received");

    if (!supabase) {
      console.error("[Gmail Debug] Supabase not initialized - env vars missing");
      console.error("[Gmail Debug] SUPABASE_URL:", SUPABASE_URL ? "SET" : "MISSING");
      console.error("[Gmail Debug] SUPABASE_SERVICE_ROLE_KEY:", SUPABASE_SERVICE_ROLE_KEY ? "SET" : "MISSING");
      return new Response(
        JSON.stringify({ error: "Supabase not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("[Gmail Debug] Supabase initialized");

    // Step 1: Validate session
    console.log("[Gmail Debug] Step 1: Validating session...");
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("*")
      .eq("session_token", sessionToken)
      .single();

    if (sessionError) {
      console.error("[Gmail Debug] Session error:", sessionError.message);
      return new Response(
        JSON.stringify({ error: "Session validation failed", details: sessionError.message }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!session) {
      console.error("[Gmail Debug] No session found");
      return new Response(
        JSON.stringify({ error: "Session not found" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const userId = session.user_id;
    console.log(`[Gmail Debug] Session validated: user_id=${userId}`);

    // Step 2: Get Google provider
    console.log("[Gmail Debug] Step 2: Getting Google OAuth provider...");
    const { data: provider, error: providerError } = await supabase
      .from("auth_providers")
      .select("access_token, refresh_token, expires_at")
      .eq("user_id", userId)
      .eq("provider", "google")
      .single();

    if (providerError) {
      console.error("[Gmail Debug] Provider error:", providerError.message);
      return new Response(
        JSON.stringify({ error: "Google OAuth not configured", details: providerError.message }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!provider) {
      console.error("[Gmail Debug] No Google provider found");
      return new Response(
        JSON.stringify({ error: "Google OAuth provider not found" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    const accessToken = provider.access_token;
    console.log("[Gmail Debug] Google provider found, token set");

    // Step 3: Test Gmail API
    console.log("[Gmail Debug] Step 3: Testing Gmail API...");
    const listRes = await fetch(`${GMAIL_API_BASE}/messages?maxResults=1`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    console.log(`[Gmail Debug] Gmail API response status: ${listRes.status}`);

    if (!listRes.ok) {
      const errorText = await listRes.text();
      console.error(`[Gmail Debug] Gmail API error: ${errorText}`);
      return new Response(
        JSON.stringify({ error: "Gmail API failed", status: listRes.status, details: errorText }),
        { status: listRes.status, headers: { "Content-Type": "application/json" } }
      );
    }

    const listData = (await listRes.json()) as any;
    console.log(`[Gmail Debug] Gmail API success, found ${listData.messages?.length || 0} messages`);

    if (!listData.messages || listData.messages.length === 0) {
      console.log("[Gmail Debug] No messages found");
      return new Response(
        JSON.stringify({
          status: "success",
          message: "No emails found",
          steps_completed: ["session_validation", "provider_retrieval", "gmail_api_test"],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Step 4: Fetch one message
    console.log("[Gmail Debug] Step 4: Fetching one message...");
    const msgId = listData.messages[0].id;
    const msgRes = await fetch(`${GMAIL_API_BASE}/messages/${msgId}?format=full`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!msgRes.ok) {
      const errorText = await msgRes.text();
      console.error(`[Gmail Debug] Message fetch failed: ${errorText}`);
      return new Response(
        JSON.stringify({ error: "Message fetch failed", details: errorText }),
        { status: msgRes.status, headers: { "Content-Type": "application/json" } }
      );
    }

    const msgData = (await msgRes.json()) as GmailMessage;
    const hdrs = msgData.payload?.headers || [];
    const sender = getHeader(hdrs, "from") || "unknown";
    const subject = getHeader(hdrs, "subject") || "(no subject)";

    console.log(`[Gmail Debug] Message fetched: from=${sender}, subject=${subject}`);

    // Step 5: Try to insert test email
    console.log("[Gmail Debug] Step 5: Testing email insert...");
    const testEmail = {
      user_id: userId,
      gmail_message_id: msgData.id,
      sender: sender,
      subject: subject,
      raw_snippet: msgData.snippet || "",
      is_insurance_related: false,
      is_spam: false,
      category: "other",
      confidence: 0,
      classified_by: "rules",
      received_at: msgData.internalDate ? new Date(parseInt(msgData.internalDate)).toISOString() : new Date().toISOString(),
    };

    console.log("[Gmail Debug] Test email object:", JSON.stringify(testEmail));

    const { error: insertError, data: insertData } = await supabase
      .from("emails")
      .upsert([testEmail], { onConflict: "gmail_message_id" })
      .select();

    if (insertError) {
      console.error("[Gmail Debug] Insert error:", insertError.message);
      console.error("[Gmail Debug] Insert error code:", insertError.code);
      console.error("[Gmail Debug] Insert error details:", insertError.details);
      return new Response(
        JSON.stringify({
          error: "Email insert failed",
          details: insertError.message,
          code: insertError.code,
          fullError: insertError,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("[Gmail Debug] Insert successful:", insertData);

    return new Response(
      JSON.stringify({
        status: "success",
        message: "All debug steps passed",
        steps_completed: [
          "session_validation",
          "provider_retrieval",
          "gmail_api_test",
          "message_fetch",
          "email_insert",
        ],
        test_email_inserted: testEmail,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error(`[Gmail Debug] Unexpected error: ${String(error)}`);
    console.error(`[Gmail Debug] Error stack:`, error.stack);
    return new Response(
      JSON.stringify({
        error: "Unexpected error",
        details: String(error),
        stack: error.stack,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
