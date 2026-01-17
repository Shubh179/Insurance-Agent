"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { getSupabaseClient } from "../utils/supabase";

/**
 * MCP Prompt 3: Risk Assessment
 * Evaluates user's risk profile based on email patterns and claims
 */
export const riskAssessmentAction = internalAction({
  args: { userId: v.string() },
  handler: async (_ctx, { userId }) => {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase not configured");
    }

    if (!GEMINI_API_KEY) {
      throw new Error("Gemini API key not configured");
    }

    const supabase = getSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch ALL insurance emails for risk analysis
    const { data: emails, error: emailError } = await supabase
      .from("emails")
      .select("*")
      .eq("user_id", userId)
      .eq("is_insurance_related", true)
      .order("received_at", { ascending: false });

    if (emailError) {
      throw new Error(`Failed to fetch emails: ${emailError.message}`);
    }

    if (!emails || emails.length === 0) {
      return {
        status: "success",
        risk_score: 50,
        risk_level: "unknown",
        risk_factors: [],
        mitigation_strategies: ["Build insurance portfolio with foundational policies"],
      };
    }

    // Analyze claim frequency and types
    const claimEmails = emails.filter((e: any) =>
      (e.body && e.body.toLowerCase().includes("claim")) ||
      e.raw_snippet.toLowerCase().includes("claim") ||
      e.subject.toLowerCase().includes("claim")
    );

    const emailContext = emails
      .map(
        (e: any) =>
          `Category: ${e.category}, Subject: ${e.subject}\nBody: ${e.body || ''}\nSnippet: ${e.raw_snippet}`
      )
      .join("\n");

    const prompt = `Assess the insurance risk profile based on claim history and communications.

User Activity:
${emailContext}

Claim Frequency: ${claimEmails.length} claims in last period
Total Policies: ${emails.length} communications analyzed

Respond with JSON:
{
  "risk_score": "number 0-100 (0=safe, 100=high-risk)",
  "risk_level": "very_low|low|moderate|high|very_high",
  "risk_factors": [
    {
      "factor": "string",
      "severity": "low|medium|high",
      "description": "string"
    }
  ],
  "mitigation_strategies": ["list of recommended actions"],
  "confidence_score": "number 0-1"
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
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Gemini API error: ${res.status} - ${JSON.stringify(errorData)}`);
      }

      const data = (await res.json()) as any;
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const result = JSON.parse(text.replace(/```json|```/g, "").trim());

      return {
        status: "success",
        risk_score: result.risk_score || 50,
        risk_level: result.risk_level || "unknown",
        risk_factors: result.risk_factors || [],
        mitigation_strategies: result.mitigation_strategies || [],
      };
    } catch (error) {
      throw new Error(`Risk assessment failed: ${String(error)}`);
    }
  },
});
