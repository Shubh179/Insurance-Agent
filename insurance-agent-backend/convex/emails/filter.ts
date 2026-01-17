import { httpAction } from "../_generated/server";
import { classifyEmail } from "../utils/emailFilter";

/**
 * POST /emails/filter
 * Test-only endpoint: classify an email without storing it
 */
export const filterEmail = httpAction(async (_ctx: any, request: Request) => {
  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed, use POST" }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const body = (await request.json()) as {
      sender?: string;
      subject?: string;
      snippet?: string;
      attachments?: string[];
    };

    const result = await classifyEmail({
      sender: body.sender,
      subject: body.subject,
      snippet: body.snippet,
      attachments: body.attachments || [],
    });

    console.log(`[EmailFilter] Classified test email: spam=${result.is_spam}, insurance=${result.is_insurance_related}, category=${result.category}`);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[EmailFilter] Classification error: ${message}`);
    return new Response(
      JSON.stringify({ error: "Failed to classify email", details: message }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
});
