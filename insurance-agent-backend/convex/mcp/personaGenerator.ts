/**
 * MCP Prompt 1: Persona Generator
 * Generates detailed user insurance persona from email history
 */
export async function personaGenerator(
  userId: string,
  geminiApiKey?: string,
  supabaseUrl?: string,
  supabaseKey?: string
): Promise<{
  status: string;
  persona: any;
  reasoning: string;
}> {
  // Use provided keys or try to get from environment
  const GEMINI_API_KEY = geminiApiKey || process.env.GEMINI_API_KEY;
  const SUPABASE_URL = supabaseUrl || process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log("[personaGenerator] checking keys:", {
    hasGemini: !!GEMINI_API_KEY,
    hasSupabase: !!SUPABASE_URL,
    hasSupabaseKey: !!SUPABASE_SERVICE_ROLE_KEY,
  });

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase not configured");
  }

  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API key not configured");
  }

  // Fetch recent insurance emails using direct REST API call
  const emailsUrl = `${SUPABASE_URL}/rest/v1/emails?select=*&user_id=eq.${userId}&is_insurance_related=eq.true&order=received_at.desc&limit=20`;
  
  console.log("[personaGenerator] Fetching emails from:", emailsUrl.substring(0, 50) + "...");
  
  const emailsResponse = await fetch(emailsUrl, {
    method: "GET",
    headers: {
      "apikey": SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
  });

  if (!emailsResponse.ok) {
    const errorText = await emailsResponse.text();
    throw new Error(`Failed to fetch emails: ${emailsResponse.status} ${errorText}`);
  }

  const emails = await emailsResponse.json() as any[];

  if (!emails || emails.length === 0) {
    return {
      status: "success",
      persona: {
        profile: "New User",
        insurance_types: [],
        risk_profile: "unknown",
        engagement_level: "low",
      },
      reasoning: "No insurance emails found. User is new or inactive.",
    };
  }

  // Build context from emails
  const emailSummary = emails
    .map((e: any) => `Subject: ${e.subject}\nSnippet: ${e.raw_snippet}`)
    .join("\n\n");

  const prompt = `Analyze this user's insurance email history and generate a detailed persona profile.

Email History:
${emailSummary}

Respond with JSON:
{
  "profile_name": "string (e.g., 'Conservative Investor', 'Active Manager')",
  "insurance_types": ["list of inferred insurance types"],
  "estimated_age_group": "string",
  "risk_profile": "conservative|moderate|aggressive",
  "engagement_level": "low|medium|high",
  "key_concerns": ["list of inferred concerns"],
  "estimated_annual_premium": "number or null",
  "policy_count": "estimated count"
}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          safetySettings: [
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
          ],
        }),
      }
    );

    if (!res.ok) {
      throw new Error(`Gemini API error: ${res.status}`);
    }

    const data = (await res.json()) as any;
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const persona = JSON.parse(text.replace(/```json|```/g, "").trim());

    // Store persona in database using direct REST API
    const personaUrl = `${SUPABASE_URL}/rest/v1/personas`;
    const personaResponse = await fetch(personaUrl, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
      },
      body: JSON.stringify({
        user_id: userId,
        persona_data: persona,
        updated_at: new Date().toISOString(),
      }),
    });

    if (!personaResponse.ok) {
      const errorText = await personaResponse.text();
      console.warn(`[MCP] Persona storage warning: ${personaResponse.status} ${errorText}`);
    }

    return {
      status: "success",
      persona,
      reasoning: `Generated from ${emails.length} insurance emails`,
    };
  } catch (error) {
    throw new Error(`Persona generation failed: ${String(error)}`);
  }
}
