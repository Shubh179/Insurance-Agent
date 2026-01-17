"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { getSupabaseClient } from "../utils/supabase";

/**
 * MCP Prompt 2: Insurance Policy Analyzer
 * Deep analysis of policy documents and terms
 */
export const policyAnalyzerAction = internalAction({
  args: { userId: v.string(), emailId: v.optional(v.string()) },
  handler: async (_ctx, { userId, emailId }) => {
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

    // Fetch ALL policy-related emails
    let query = supabase
      .from("emails")
      .select("*")
      .eq("user_id", userId)
      .eq("is_insurance_related", true)
      .in("category", ["insurance"])
      .order("received_at", { ascending: false });

    if (emailId) {
      query = query.eq("id", emailId);
    }

    const { data: emails, error: emailError } = await query;

    if (emailError) {
      throw new Error(`Failed to fetch emails: ${emailError.message}`);
    }

    if (!emails || emails.length === 0) {
      return {
        status: "success",
        policies: [],
        compliance_score: 0,
        recommendations: ["No policy documents found. Please add insurance policies for analysis."],
      };
    }

    const emailSummary = emails
      .map((e: any) => `Date: ${e.received_at}\nSubject: ${e.subject}\nBody: ${e.body || ''}\nContent: ${e.raw_snippet}`)
      .join("\n---\n");

    const prompt = `Analyze the following insurance policy communications and extract key policy details.

Documents:
${emailSummary}

Respond with JSON:
{
  "policies": [
    {
      "policy_number": "string or null",
      "type": "string (e.g., Life, Health, Auto)",
      "provider": "string",
      "coverage_amount": "string or null",
      "renewal_date": "date or null",
      "status": "active|expired|pending"
    }
  ],
  "compliance_score": "number 0-100 (coverage adequacy)",
  "recommendations": ["list of actionable recommendations"],
  "risk_gaps": ["identified coverage gaps"]
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
        policies: result.policies || [],
        compliance_score: result.compliance_score || 0,
        recommendations: result.recommendations || [],
      };
  } catch (error) {
    throw new Error(`Policy analysis failed: ${String(error)}`);
  }
  },
});
