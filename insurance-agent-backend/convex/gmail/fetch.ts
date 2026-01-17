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

export const fetchGmail = httpAction(async (_ctx, request) => {
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

    const body = (await request.json()) as {
      email?: string;
      googleId?: string;
      accessToken?: string;
      maxResults?: number;
      mock?: boolean;
    };

    const maxResults = body.maxResults ?? 10;
    const isMock = Boolean(body.mock);

    // Resolve access token: use provided or fetch from users table
    let accessToken = body.accessToken;
    let userId: string | undefined;

    if (!accessToken) {
      if (!body.email && !body.googleId) {
        return new Response(
          JSON.stringify({ error: "Provide accessToken or (email / googleId) to fetch stored token" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const { data: user, error: userErr } = await supabase
        .from("users")
        .select("id, access_token, email, google_id")
        .or(
          [
            body.email ? `email.eq.${body.email}` : undefined,
            body.googleId ? `google_id.eq.${body.googleId}` : undefined,
          ]
            .filter(Boolean)
            .join(",")
        )
        .single();

      if (userErr || !user) {
        return new Response(
          JSON.stringify({ error: "User not found for provided email/googleId" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }

      accessToken = user.access_token;
      userId = user.id;
    }

    // If mock mode, just insert a sample email
    if (isMock) {
      const now = new Date().toISOString();
      const mockEmail = {
        user_id: userId ?? crypto.randomUUID(),
        message_id: `mock-${Date.now()}`,
        from: "insurer@example.com",
        to: body.email ?? "user@example.com",
        subject: "Your Insurance Policy Update",
        body: "This is a mock email about your insurance policy.",
        is_spam: false,
        is_insurance_related: true,
        category: "insurance",
        received_at: now,
        fetched_at: now,
      };

      const { error: upsertErr } = await supabase.from("emails").upsert([mockEmail], {
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
          inserted: 1,
          emails: [mockEmail],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: "Access token not available" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // List messages
    const listRes = await fetch(`${GMAIL_API_BASE}/messages?maxResults=${maxResults}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!listRes.ok) {
      const text = await listRes.text();
      return new Response(
        JSON.stringify({ error: "Failed to list Gmail messages", status: listRes.status, body: text }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const listData = (await listRes.json()) as GmailListResponse;
    const messages = listData.messages ?? [];

    // Fetch details for each message
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
        user_id: userId ?? "", // optional; if missing, rely on provided email
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
        subjects: filteredRows.slice(0, 10).map((r) => r.subject),
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
