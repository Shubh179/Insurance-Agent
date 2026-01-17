import { httpAction } from "../_generated/server";
import { getSupabaseClient } from "../utils/supabase";
import { classifyEmail } from "../utils/emailFilter";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing required Supabase environment variables");
}

let supabase: any = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  supabase = getSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

const GMAIL_API_BASE = "https://www.googleapis.com/gmail/v1/users/me";
const MAX_RESULTS_PER_PAGE = 100;
// 10 days lookback
const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;

interface GmailListResponse {
  messages?: { id: string; threadId: string }[];
  resultSizeEstimate?: number;
  nextPageToken?: string;
}

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
 * Compute deterministic timestamp for "10 days ago"
 */
function getTenDaysAgoTimestamp(): number {
  const now = Date.now();
  return Math.floor((now - TEN_DAYS_MS) / 1000); // Convert to UNIX seconds
}

/**
 * Validate session and return user_id
 */
async function validateSessionAndGetUserId(sessionToken: string): Promise<string> {
  if (!supabase) {
    throw new Error("Supabase not initialized");
  }

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
 * Get Google auth provider for user
 */
async function getGoogleProvider(userId: string): Promise<{ access_token: string; refresh_token: string | null; expires_at: string }> {
  if (!supabase) {
    throw new Error("Supabase not initialized");
  }

  const { data: provider, error: providerError } = await supabase
    .from("auth_providers")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .eq("provider", "google")
    .single();

  if (providerError || !provider) {
    throw new Error("Google OAuth not configured. Please authenticate first.");
  }

  return provider;
}

/**
 * Refresh Google access token if expired
 */
async function refreshAccessTokenIfNeeded(
  userId: string,
  provider: { access_token: string; refresh_token: string | null; expires_at: string }
): Promise<string> {
  if (!supabase) {
    throw new Error("Supabase not initialized");
  }

  const expiresAt = new Date(provider.expires_at);
  const now = new Date();

  // If token expires within 5 minutes, refresh it
  if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    console.log(`[Gmail] Access token expiring soon, refreshing...`);

    if (!provider.refresh_token) {
      throw new Error("No refresh token available. Please re-authenticate.");
    }

    try {
      const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID!,
          client_secret: GOOGLE_CLIENT_SECRET!,
          refresh_token: provider.refresh_token,
          grant_type: "refresh_token",
        }).toString(),
      });

      if (!refreshResponse.ok) {
        const errorText = await refreshResponse.text();
        throw new Error(`Token refresh failed: ${errorText}`);
      }

      const newTokenData = (await refreshResponse.json()) as {
        access_token: string;
        expires_in: number;
      };

      const newExpiresAt = new Date(Date.now() + newTokenData.expires_in * 1000);

      // Update provider in database
      const { error: updateError } = await supabase
        .from("auth_providers")
        .update({
          access_token: newTokenData.access_token,
          expires_at: newExpiresAt.toISOString(),
        })
        .eq("user_id", userId)
        .eq("provider", "google");

      if (updateError) {
        console.error(`[Gmail] Failed to update tokens: ${updateError.message}`);
      }

      console.log(`[Gmail] Token refresh successful, new expiry: ${newExpiresAt.toISOString()}`);
      return newTokenData.access_token;
    } catch (error) {
      console.error(`[Gmail] Token refresh error: ${String(error)}`);
      throw error;
    }
  }

  return provider.access_token;
}

/**
 * Fetch ALL messages from Gmail with pagination
 * Uses deterministic 10-day time filter with after: query
 */
async function fetchAllGmailMessages(
  accessToken: string,
  userId: string
): Promise<{ totalFetched: number; totalInserted: number; emails: any[] }> {
  if (!supabase) {
    throw new Error("Supabase not initialized");
  }

  const tenDaysAgoUnix = getTenDaysAgoTimestamp();
  const gmailQuery = `after:${tenDaysAgoUnix}`;

  console.log(`[Gmail] Starting pagination with query: "${gmailQuery}"`);
  console.log(`[Gmail] 10 days ago timestamp: ${tenDaysAgoUnix}`);

  const emailsToInsert: any[] = [];
  let pageToken: string | undefined;
  let pageCount = 0;
  let totalFetched = 0;
  let totalInserted = 0;

  do {
    pageCount++;
    console.log(`[Gmail] Fetching page ${pageCount}...`);

    // Build URL with pagination
    const url = new URL(`${GMAIL_API_BASE}/messages`);
    url.searchParams.set("q", gmailQuery);
    url.searchParams.set("maxResults", MAX_RESULTS_PER_PAGE.toString());
    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    }

    const listRes = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!listRes.ok) {
      const errorText = await listRes.text();
      console.error(`[Gmail] Gmail API error ${listRes.status}: ${errorText}`);
      throw new Error(`Gmail API list failed: ${listRes.status} ${errorText}`);
    }

    const listData = (await listRes.json()) as GmailListResponse;

    if (!listData.messages || listData.messages.length === 0) {
      console.log(`[Gmail] Page ${pageCount} returned no messages, stopping pagination`);
      break;
    }

    console.log(`[Gmail] Page ${pageCount}: Found ${listData.messages.length} messages`);
    totalFetched += listData.messages.length;

    // Fetch full details for each message
    for (const msg of listData.messages) {
      try {
        const msgRes = await fetch(`${GMAIL_API_BASE}/messages/${msg.id}?format=full`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!msgRes.ok) {
          console.warn(`[Gmail] Failed to fetch message ${msg.id}: ${msgRes.status}`);
          continue;
        }

        const msgData = (await msgRes.json()) as GmailMessage;
        const hdrs = msgData.payload?.headers || [];

        const fromHeader = getHeader(hdrs, "from");
        const subjectHeader = getHeader(hdrs, "subject");
        const dateHeader = getHeader(hdrs, "date");
        const snippet = msgData.snippet || "";

        // Parse received_at from internalDate (milliseconds since epoch)
        const receivedAt = msgData.internalDate
          ? new Date(parseInt(msgData.internalDate)).toISOString()
          : new Date().toISOString();

        // Classify email (deterministic rules, no LLM)
        let classification: any = {
          is_insurance_related: false,
          is_spam: false,
          category: "other",
          confidence: 0,
          classified_by: "rules",
        };

        try {
          classification = await classifyEmail({
            sender: fromHeader,
            subject: subjectHeader,
            snippet,
            attachments: [],
          });
        } catch (classifyError) {
          console.warn(`[Gmail] Classification failed for ${msgData.id}: ${String(classifyError)}, using defaults`);
        }

        const resolvedCategory =
          classification.is_spam ? "spam" :
            classification.is_insurance_related ? "insurance" :
              "other";

        // Only store insurance-related emails
        if (classification.is_insurance_related) {
          // Map classifier values to database-allowed values: 'rules' or 'rules+ai'
          let classifiedByValue: "rules" | "rules+ai" = "rules";
          if (classification.classified_by === "gemini_fallback") {
            classifiedByValue = "rules+ai"; // Gemini validation counts as AI-assisted rules
          }

          emailsToInsert.push({
            user_id: userId,
            gmail_message_id: msgData.id,
            sender: fromHeader || "unknown",
            subject: subjectHeader || "(no subject)",
            raw_snippet: snippet,
            is_insurance_related: true,
            is_spam: classification.is_spam || false,
            category: resolvedCategory,
            confidence: classification.confidence || 0,
            classified_by: classifiedByValue,
            received_at: receivedAt,
          });
        }
      } catch (error) {
        console.error(`[Gmail] Error processing message ${msg.id}: ${String(error)}`);
      }
    }

    // Get next page token
    pageToken = listData.nextPageToken;
    if (pageToken) {
      console.log(`[Gmail] Page ${pageCount} has nextPageToken, continuing...`);
    } else {
      console.log(`[Gmail] No nextPageToken, pagination complete`);
    }
  } while (pageToken);

  console.log(`[Gmail] Pagination complete: ${pageCount} pages, ${totalFetched} total fetched`);
  console.log(`[Gmail] Total emails collected for insert: ${emailsToInsert.length}`);

  // Upsert emails to Supabase (idempotent using gmail_message_id)
  if (emailsToInsert.length > 0) {
    console.log(`[Gmail] ✓ Starting database upsert for ${emailsToInsert.length} emails...`);
    console.log(`[Gmail] Sample email structure:`, JSON.stringify(emailsToInsert[0], null, 2));

    try {
      const { error: upsertError, count: upsertCount, data: upsertData } = await supabase
        .from("emails")
        .upsert(emailsToInsert, { onConflict: "gmail_message_id" });

      if (upsertError) {
        console.error(`[Gmail] ✗ Upsert error:`, upsertError);
        console.error(`[Gmail] Error details: ${JSON.stringify(upsertError)}`);
        throw new Error(`Failed to store emails: ${upsertError.message}`);
      }

      console.log(`[Gmail] ✓ Upsert successful! Count: ${upsertCount}, Processed: ${emailsToInsert.length}`);
      console.log(`[Gmail] Upsert result data:`, upsertData);

      return {
        totalFetched,
        totalInserted: emailsToInsert.length,
        emails: emailsToInsert,
      };
    } catch (upsertError) {
      console.error(`[Gmail] ✗ Upsert exception: ${String(upsertError)}`);
      console.error(`[Gmail] Full error:`, upsertError);
      throw upsertError;
    }
  } else {
    console.log(`[Gmail] ⚠ No emails in final buffer`);
  }

  return {
    totalFetched,
    totalInserted,
    emails: emailsToInsert
  };
}

/**
 * Sync ALL Gmail emails from last 10 days using deterministic pagination
 * POST /gmail/sync
 * Requires Authorization: Bearer <sessionToken>
 */
export const gmailSyncReal = httpAction(async (_ctx: any, request: Request) => {
  try {
    // Validate method
    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed, use POST" }),
        {
          status: 405,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        }
      );
    }

    // Get session token from Authorization header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", details: "Missing or invalid Authorization header" }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        }
      );
    }

    const sessionToken = authHeader.substring(7);

    // Parse request body (validate no tokens passed)
    const body = (await request.json()) as Record<string, unknown>;

    const forbiddenTokenKeys = ["access_token", "refresh_token", "id_token", "token", "oauth_token"];
    for (const key of forbiddenTokenKeys) {
      if (key in body) {
        console.error(`[Gmail] Forbidden token field received in request body: ${key}`);
        return new Response(
          JSON.stringify({
            error: "Forbidden",
            details: "Do not pass tokens in the request body. Complete OAuth in the browser via /auth/google.",
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            }
          }
        );
      }
    }

    console.log(`[Gmail] Starting full 10-day sync`);

    // Validate session and get user_id
    const userId = await validateSessionAndGetUserId(sessionToken);
    console.log(`[Gmail] Session validated for user: ${userId}`);

    // Get Google provider
    const provider = await getGoogleProvider(userId);

    // Refresh token if needed
    const accessToken = await refreshAccessTokenIfNeeded(userId, provider);

    // Fetch ALL emails with pagination
    const result = await fetchAllGmailMessages(accessToken, userId);

    console.log(`[Gmail] Sync complete: ${result.totalFetched} fetched, ${result.totalInserted} inserted`);

    return new Response(
      JSON.stringify({
        status: "success",
        message: "Gmail sync complete",
        timeframe: "last_10_days",
        total_fetched: result.totalFetched,
        total_inserted: result.totalInserted,
        insurance_related_count: result.emails.filter((e) => e.is_insurance_related).length,
        sample_emails: result.emails.slice(0, 5).map((e) => ({
          sender: e.sender,
          subject: e.subject,
          is_insurance_related: e.is_insurance_related,
          received_at: e.received_at,
        })),
      }),
      {

        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  } catch (error) {
    const errorMessage = String(error);

    if (errorMessage.includes("Invalid session token")) {
      console.error(`[Gmail] Invalid session: ${errorMessage}`);
      return new Response(
        JSON.stringify({ error: "Unauthorized", details: "Invalid session token" }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        }
      );
    }

    if (errorMessage.includes("Session expired")) {
      console.error(`[Gmail] Session expired: ${errorMessage}`);
      return new Response(
        JSON.stringify({ error: "Unauthorized", details: "Session expired, please login again" }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        }
      );
    }

    if (errorMessage.includes("Google OAuth not configured")) {
      console.error(`[Gmail] No Google OAuth: ${errorMessage}`);
      return new Response(
        JSON.stringify({
          error: "Not configured",
          details: "Please authenticate with Google first",
        }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        }
      );
    }

    console.error(`[Gmail] Sync error: ${errorMessage}`);
    return new Response(
      JSON.stringify({
        error: "Gmail sync failed",
        details: errorMessage,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  }
});
