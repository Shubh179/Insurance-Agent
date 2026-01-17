import { httpAction } from "../_generated/server";
import { getSupabaseClient } from "../utils/supabase";

const GMAIL_API_BASE = "https://www.googleapis.com/gmail/v1/users/me";

interface GmailListResponse {
  messages?: { id: string; threadId: string }[];
  resultSizeEstimate?: number;
}

interface GmailMessage {
  id: string;
  snippet?: string;
  internalDate?: string;
  payload?: {
    headers?: { name: string; value: string }[];
  };
}

function header(headers: { name: string; value: string }[] | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  const h = headers.find((h) => h.name?.toLowerCase() === name.toLowerCase());
  return h?.value;
}

function looksInsurance(subject?: string, from?: string, snippet?: string): boolean {
  const text = [subject, from, snippet].filter(Boolean).join(" ").toLowerCase();
  return /(insurance|policy|claim|premium|coverage)/i.test(text);
}

/**
 * Sync Gmail emails for authenticated user
 * Requires: email OR userId (to lookup auth provider)
 * Reads tokens from auth_providers table (production OAuth model)
 */
export const gmailSync = httpAction(async (_ctx, request) => {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = getSupabaseClient(supabaseUrl, supabaseKey);

    // Support both GET and POST
    let body: any = {};
    if (request.method === "POST") {
      body = await request.json();
    } else if (request.method === "GET") {
      const url = new URL(request.url);
      body = {
        email: url.searchParams.get("email"),
        userId: url.searchParams.get("userId"),
        maxResults: parseInt(url.searchParams.get("maxResults") || "10", 10),
        mock: url.searchParams.get("mock") === "true",
      };
    }

    const maxResults = body.maxResults ?? 10;
    const isMock = Boolean(body.mock);

    // Resolve user and access token from auth_providers
    let userId: string | undefined;
    let accessToken: string | undefined;
    let userEmail: string | undefined;

    if (body.userId) {
      userId = body.userId;
    } else if (body.email) {
      // Lookup user by email
      const { data: user, error: userErr } = await supabase
        .from("users")
        .select("id, email")
        .eq("email", body.email)
        .single();

      if (userErr || !user) {
        return new Response(
          JSON.stringify({ error: "User not found", details: userErr?.message }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }

      userId = user.id;
      userEmail = user.email;
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Provide userId or email to identify user" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get Google auth provider for this user
    if (!isMock) {
      const { data: provider, error: providerErr } = await supabase
        .from("auth_providers")
        .select("access_token, expires_at")
        .eq("user_id", userId)
        .eq("provider", "google")
        .single();

      if (providerErr || !provider) {
        return new Response(
          JSON.stringify({
            error: "Google auth not configured for this user",
            details: "User must authenticate with Google first",
          }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }

      // Check token expiry
      if (provider.expires_at && new Date(provider.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({
            error: "Google access token expired",
            details: "User must re-authenticate",
          }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }

      accessToken = provider.access_token;
    }

    // MOCK MODE: Return sample emails
    if (isMock) {
      console.log(`[Gmail] Mock mode enabled for user: ${userId}`);

      const mockEmails = [
        {
          id: Math.random().toString(),
          message_id: `mock_1_${Date.now()}`,
          from: "claims@insurancepro.com",
          to: body.email || "user@example.com",
          subject: "Your Insurance Claim Status - Policy #12345",
          body: "Your recent claim has been approved for review...",
          is_insurance_related: true,
          is_spam: false,
          category: "insurance",
        },
        {
          id: Math.random().toString(),
          message_id: `mock_2_${Date.now()}`,
          from: "support@healthinsurance.io",
          to: body.email || "user@example.com",
          subject: "Annual Policy Renewal - Action Required",
          body: "Your health insurance policy renews next month...",
          is_insurance_related: true,
          is_spam: false,
          category: "insurance",
        },
        {
          id: Math.random().toString(),
          message_id: `mock_3_${Date.now()}`,
          from: "spam@scams.com",
          to: body.email || "user@example.com",
          subject: "WIN FREE INSURANCE!!! Click here!!!",
          body: "You have been selected...",
          is_insurance_related: true,
          is_spam: true,
          category: "spam",
        },
      ];

      // Insert mock emails
      const insertData = mockEmails.map((email) => ({
        user_id: userId,
        message_id: email.message_id,
        from: email.from,
        to: email.to,
        subject: email.subject,
        body: email.body,
        is_insurance_related: email.is_insurance_related,
        is_spam: email.is_spam,
        category: email.category,
        received_at: new Date().toISOString(),
      }));

      const { error: insertErr } = await supabase
        .from("emails")
        .upsert(insertData, { onConflict: "message_id" });

      if (insertErr) {
        console.error(`[Gmail] Mock insert error: ${insertErr.message}`);
        return new Response(
          JSON.stringify({
            error: "Failed to insert mock emails",
            details: insertErr.message,
          }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          status: "mocked",
          message: "Mock emails inserted",
          count: mockEmails.length,
          emails: mockEmails.slice(0, 3).map((e) => ({
            from: e.from,
            subject: e.subject,
            isInsurance: e.is_insurance_related,
            isSpam: e.is_spam,
          })),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // REAL GMAIL API: Fetch from Gmail
    console.log(`[Gmail] Fetching emails for user: ${userId} with accessToken`);

    // List messages
    const listRes = await fetch(
      `${GMAIL_API_BASE}/messages?maxResults=${maxResults}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!listRes.ok) {
      const errText = await listRes.text();
      console.error(`[Gmail] List error ${listRes.status}: ${errText}`);
      return new Response(
        JSON.stringify({
          error: "Failed to list Gmail messages",
          status: listRes.status,
          details: errText,
        }),
        { status: listRes.status, headers: { "Content-Type": "application/json" } }
      );
    }

    const listData = (await listRes.json()) as GmailListResponse;
    if (!listData.messages || listData.messages.length === 0) {
      return new Response(
        JSON.stringify({
          status: "success",
          message: "No emails found",
          count: 0,
          emails: [],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Fetch full message details
    const emailsToInsert: any[] = [];

    for (const msg of listData.messages) {
      const msgRes = await fetch(
        `${GMAIL_API_BASE}/messages/${msg.id}?format=full`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!msgRes.ok) {
        console.warn(`[Gmail] Failed to fetch message ${msg.id}`);
        continue;
      }

      const msgData = (await msgRes.json()) as GmailMessage;
      const hdrs = msgData.payload?.headers || [];

      const fromHeader = header(hdrs, "from");
      const toHeader = header(hdrs, "to");
      const subjectHeader = header(hdrs, "subject");
      const snippet = msgData.snippet || "";

      const isInsurance = looksInsurance(subjectHeader, fromHeader, snippet);

      emailsToInsert.push({
        user_id: userId,
        message_id: msgData.id,
        from: fromHeader || "unknown",
        to: toHeader || "unknown",
        subject: subjectHeader || "(no subject)",
        body: snippet,
        is_insurance_related: isInsurance,
        is_spam: false, // Will be determined by spam filter agent
        category: isInsurance ? "insurance" : "other",
        received_at: new Date(parseInt(msgData.internalDate || "0")).toISOString(),
      });
    }

    if (emailsToInsert.length === 0) {
      return new Response(
        JSON.stringify({
          status: "success",
          message: "No emails processed",
          count: 0,
          emails: [],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Upsert emails (on conflict: do nothing to avoid duplicates)
    const { error: insertErr } = await supabase
      .from("emails")
      .upsert(emailsToInsert, { onConflict: "message_id" });

    if (insertErr) {
      console.error(`[Gmail] Insert error: ${insertErr.message}`);
      return new Response(
        JSON.stringify({
          error: "Failed to store emails",
          details: insertErr.message,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const insuranceCount = emailsToInsert.filter((e) => e.is_insurance_related).length;

    return new Response(
      JSON.stringify({
        status: "success",
        message: "Emails synchronized",
        count: emailsToInsert.length,
        insuranceCount,
        emails: emailsToInsert.slice(0, 5).map((e) => ({
          from: e.from,
          subject: e.subject,
          isInsurance: e.is_insurance_related,
          receivedAt: e.received_at,
        })),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[Gmail] Sync error: ${String(error)}`);
    return new Response(
      JSON.stringify({
        error: "Gmail sync failed",
        details: String(error),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
