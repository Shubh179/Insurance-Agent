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

// GET endpoint with query parameters for browser testing
export const fetchGmailGet = httpAction(async (_ctx, request) => {
  try {
    const url = new URL(request.url);
    const email = url.searchParams.get("email");
    const maxResults = parseInt(url.searchParams.get("maxResults") || "10");
    const mock = url.searchParams.has("mock");

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = getSupabaseClient(supabaseUrl, supabaseKey);

    // Mock mode for testing without real Gmail access
    if (mock) {
      const now = new Date().toISOString();
      const mockEmails = [
        {
          user_id: crypto.randomUUID(),
          message_id: `mock-insurance-${Date.now()}`,
          from: "claims@insurancecompany.com",
          to: email || "user@example.com",
          subject: "Your Insurance Claim Status Update",
          body: "Your recent claim has been processed and approved. Please review the attached documents.",
          is_spam: false,
          is_insurance_related: true,
          category: "insurance",
          received_at: now,
          fetched_at: now,
        },
        {
          user_id: crypto.randomUUID(),
          message_id: `mock-policy-${Date.now()}`,
          from: "support@insurancecompany.com",
          to: email || "user@example.com",
          subject: "Policy Renewal Reminder - Action Required",
          body: "Your insurance policy renewal is due next month. Click here to renew.",
          is_spam: false,
          is_insurance_related: true,
          category: "insurance",
          received_at: new Date(Date.now() - 86400000).toISOString(),
          fetched_at: now,
        },
        {
          user_id: crypto.randomUUID(),
          message_id: `mock-spam-${Date.now()}`,
          from: "noreply@spammer.com",
          to: email || "user@example.com",
          subject: "Click Here for Amazing Offers!!!",
          body: "You have been selected for exclusive deals. Click now to claim your prize!",
          is_spam: true,
          is_insurance_related: false,
          category: "spam",
          received_at: new Date(Date.now() - 172800000).toISOString(),
          fetched_at: now,
        },
      ];

      const { error: upsertErr } = await supabase.from("emails").upsert(mockEmails, {
        onConflict: "message_id",
      });

      if (upsertErr) {
        return new Response(
          JSON.stringify({ error: upsertErr.message }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          status: "mocked",
          inserted: mockEmails.length,
          emails: mockEmails.map((e) => ({
            from: e.from,
            to: e.to,
            subject: e.subject,
            category: e.category,
            received_at: e.received_at,
          })),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!email) {
      return new Response(
        JSON.stringify({
          error: "Missing 'email' query parameter",
          example: "?email=user@gmail.com&mock=true",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Fetch stored token for user
    const { data: user, error: userErr } = await supabase
      .from("users")
      .select("id, access_token, email, google_id")
      .eq("email", email)
      .single();

    if (userErr || !user) {
      return new Response(
        JSON.stringify({
          error: "User not found. Please authenticate first using /auth/google/mock",
          hint: "Email must be registered in users table with valid access_token",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const accessToken = user.access_token;

    // List messages from Gmail API
    const listRes = await fetch(`${GMAIL_API_BASE}/messages?maxResults=${maxResults}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!listRes.ok) {
      const text = await listRes.text();
      return new Response(
        JSON.stringify({
          error: "Failed to list Gmail messages",
          status: listRes.status,
          details: text.substring(0, 200),
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const listData = (await listRes.json()) as GmailListResponse;
    const messages = listData.messages ?? [];

    // Fetch message details
    const details: GmailMessage[] = [];
    for (const m of messages) {
      const msgRes = await fetch(
        `${GMAIL_API_BASE}/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!msgRes.ok) continue;
      const msgData = (await msgRes.json()) as GmailMessage;
      details.push(msgData);
    }

    // Map to Supabase rows
    const rows = details.map((msg) => {
      const from = header(msg.payload?.headers, "From") ?? "";
      const to = header(msg.payload?.headers, "To") ?? "";
      const subject = header(msg.payload?.headers, "Subject") ?? "(no subject)";
      const dateHeader = header(msg.payload?.headers, "Date");
      const received = dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString();
      const isInsurance = looksInsurance(subject, from, msg.snippet);

      return {
        user_id: user.id,
        message_id: msg.id,
        from,
        to,
        subject,
        body: msg.snippet ?? null,
        is_spam: false,
        is_insurance_related: isInsurance,
        category: isInsurance ? "insurance" : "other",
        received_at: received,
        fetched_at: new Date().toISOString(),
      };
    });

    const filteredRows = rows.filter((r) => r.message_id);

    if (filteredRows.length === 0) {
      return new Response(
        JSON.stringify({ status: "ok", inserted: 0, message: "No messages fetched" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const { error: upsertErr } = await supabase.from("emails").upsert(filteredRows, {
      onConflict: "message_id",
    });

    if (upsertErr) {
      return new Response(
        JSON.stringify({ error: upsertErr.message }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        status: "success",
        inserted: filteredRows.length,
        messagesFetched: messages.length,
        emails: filteredRows.slice(0, 5).map((r) => ({
          from: r.from,
          to: r.to,
          subject: r.subject,
          category: r.category,
          received_at: r.received_at,
        })),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
