"use node";

import { internalAction } from "../_generated/server";
import { getSupabaseClient } from "../utils/supabase";

/**
 * Internal action for persona generation
 * Fetches emails from Supabase and calls Gemini to generate persona
 */
export const personaGeneratorAction = internalAction(
  async (ctx, args: { userId: string }) => {
    const userId = args.userId;
    
    // Create Supabase client
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase not configured");
    }

    const supabase = getSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch ALL insurance emails from Supabase
    const { data: emails, error } = await supabase
      .from("emails")
      .select("*")
      .eq("user_id", userId)
      .eq("is_insurance_related", true)
      .order("received_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch emails: ${error.message}`);
    }

    if (!emails || emails.length === 0) {
      return {
        status: "success",
        persona: {
          profile_name: "New User",
          insurance_types: [],
          risk_profile: "unknown",
          engagement_level: "low",
        },
        reasoning: "No insurance emails found. User is new or inactive.",
      };
    }

    // Build context from emails
    const emailSummary = (emails as any[])
      .map((e: any) => `Subject: ${e.subject}\nBody: ${e.body || ''}\nSnippet: ${e.raw_snippet}`)
      .join("\n\n");

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
      throw new Error("Gemini API key not configured");
    }

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

    // Call Gemini API
    const geminiResponse = await fetch(
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

    if (!geminiResponse.ok) {
      const errorData = await geminiResponse.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`Gemini API error: ${geminiResponse.status} - ${JSON.stringify(errorData)}`);
    }

    const data = (await geminiResponse.json()) as any;
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const persona = JSON.parse(text.replace(/```json|```/g, "").trim());

    return {
      status: "success",
      persona,
      reasoning: `Generated from ${emails.length} insurance emails`,
    };
  }
);
