/**
 * Cloudflare Worker for MCP Persona Generation
 * 
 * Deploy this to Cloudflare Workers:
 * 1. Go to https://dash.cloudflare.com
 * 2. Workers & Pages > Create Worker
 * 3. Copy this code
 * 4. Deploy
 * 5. Update CLOUDFLARE_WORKER_URL in Convex env with the worker URL
 */

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      const { user_id, gemini_api_key, supabase_url, supabase_key } = await request.json();

      if (!user_id || !gemini_api_key || !supabase_url || !supabase_key) {
        return new Response(
          JSON.stringify({ error: "Missing required parameters" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Fetch emails from Supabase
      // Ensure URL has https://
      const baseUrl = supabase_url.startsWith('http') ? supabase_url : `https://${supabase_url}`;
      const emailsUrl = `${baseUrl}/rest/v1/emails?select=*&user_id=eq.${user_id}&is_insurance_related=eq.true&order=received_at.desc&limit=20`;
      
      console.log(`[mcp-persona] Fetching from: ${emailsUrl.substring(0, 60)}...`);
      
      const emailsResponse = await fetch(emailsUrl, {
        method: "GET",
        headers: {
          "apikey": supabase_key,
          "Authorization": `Bearer ${supabase_key}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
          "User-Agent": "Cloudflare-Worker",
        },
      });

      if (!emailsResponse.ok) {
        const errorText = await emailsResponse.text();
        throw new Error(`Failed to fetch emails: ${emailsResponse.status} ${errorText}`);
      }

      const emails = await emailsResponse.json();

      if (!emails || emails.length === 0) {
        return new Response(
          JSON.stringify({
            status: "success",
            persona: {
              profile_name: "New User",
              insurance_types: [],
              risk_profile: "unknown",
              engagement_level: "low",
            },
            reasoning: "No insurance emails found. User is new or inactive.",
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }

      // Build context from emails
      const emailSummary = emails
        .map((e) => `Subject: ${e.subject}\nSnippet: ${e.raw_snippet}`)
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

      // Call Gemini API
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${gemini_api_key}`,
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
        throw new Error(`Gemini API error: ${geminiResponse.status}`);
      }

      const data = await geminiResponse.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const persona = JSON.parse(text.replace(/```json|```/g, "").trim());

      // Store persona in Supabase
      const personaUrl = `${baseUrl}/rest/v1/personas`;
      const personaResponse = await fetch(personaUrl, {
        method: "POST",
        headers: {
          "apikey": supabase_key,
          "Authorization": `Bearer ${supabase_key}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Prefer": "resolution=merge-duplicates",
          "User-Agent": "Cloudflare-Worker",
        },
        body: JSON.stringify({
          user_id: user_id,
          persona_data: persona,
          updated_at: new Date().toISOString(),
        }),
      });

      if (!personaResponse.ok) {
        const errorText = await personaResponse.text();
        console.warn(`Persona storage warning: ${personaResponse.status} ${errorText}`);
      }

      return new Response(
        JSON.stringify({
          status: "success",
          persona,
          reasoning: `Generated from ${emails.length} insurance emails`,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: "Persona generation failed",
          details: error.message,
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }
  },
};
