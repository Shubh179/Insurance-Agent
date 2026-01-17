import { httpAction } from "../_generated/server";
import { getSupabaseClient } from "../utils/supabase";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = "https://greedy-nightingale-153.convex.site/auth/google/callback";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing required Supabase environment variables");
}

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  throw new Error("Missing required Google OAuth environment variables");
}

const supabase = getSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Step 1: Initiate Google OAuth Flow
 * GET /auth/google → Redirects browser to Google authorization endpoint
 */
export const googleAuthStart = httpAction(async (_ctx: any, request: Request) => {
  console.log("🔥 ACTIVE GOOGLE OAUTH HANDLER HIT 🔥");
  console.log("🔥 REDIRECT URI USED:", REDIRECT_URI);
  console.log("🔥 Request URL:", request.url);

  try {
    const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    googleAuthUrl.searchParams.append("client_id", GOOGLE_CLIENT_ID!);
    googleAuthUrl.searchParams.append("redirect_uri", REDIRECT_URI);
    googleAuthUrl.searchParams.append("response_type", "code");
    googleAuthUrl.searchParams.append("access_type", "offline");
    googleAuthUrl.searchParams.append("prompt", "consent");
    googleAuthUrl.searchParams.append("scope", [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/gmail.readonly",
    ].join(" "));
    googleAuthUrl.searchParams.append("state", generateRandomState());

    console.log(`[OAuth] Starting Google auth flow, redirecting to Google with redirect_uri=${REDIRECT_URI}`);

    return new Response(null, {
      status: 302,
      headers: {
        "Location": googleAuthUrl.toString(),
      },
    });
  } catch (error) {
    console.error(`[OAuth] Auth start error: ${String(error)}`);
    return new Response(
      JSON.stringify({
        error: "Failed to start OAuth flow",
        details: String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});

/**
 * Step 2: Google OAuth Callback
 * GET /auth/google/callback?code=...&state=...
 * Exchange authorization code for tokens
 */
export const googleAuthCallback = httpAction(async (_ctx: any, request: Request) => {
  console.log("🔥 ACTIVE GOOGLE CALLBACK HANDLER HIT - REDIRECT FIX APPLIED 🔥");
  console.log("🔥 REQUEST URL:", request.url);
  console.log("🔥 REDIRECT URI CONSTANT:", REDIRECT_URI);

  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    const forbiddenTokenParams = ["access_token", "refresh_token", "id_token", "token", "oauth_token"];
    for (const param of forbiddenTokenParams) {
      if (url.searchParams.has(param)) {
        console.error(`[OAuth] Forbidden token param detected in callback: ${param}`);
        return new Response(
          `<html><body><h1>Error</h1><p>Do not supply tokens directly. Restart OAuth from /auth/google.</p></body></html>`,
          { status: 400, headers: { "Content-Type": "text/html" } }
        );
      }
    }

    if (!code) {
      console.error(`[OAuth] Callback missing authorization code`);
      return new Response(
        `<html><body><h1>Error</h1><p>Missing authorization code. Did you deny access?</p></body></html>`,
        { status: 400, headers: { "Content-Type": "text/html" } }
      );
    }

    console.log(`[OAuth] Received authorization code, exchanging for tokens...`);

    // Step 2a: Exchange code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        code,
        grant_type: "authorization_code",
        redirect_uri: REDIRECT_URI,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error(`[OAuth] Token exchange failed: ${errorText}`);
      return new Response(
        `<html><body><h1>Error</h1><p>Failed to exchange code for tokens: ${errorText}</p></body></html>`,
        { status: 400, headers: { "Content-Type": "text/html" } }
      );
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      id_token: string;
      token_type: string;
    };

    console.log(`[OAuth] Token exchange successful, access_token expires in ${tokenData.expires_in}s`);

    // Step 2b: Decode ID token to extract email and Google user ID
    const { email, sub: googleUserId } = decodeIdToken(tokenData.id_token);

    if (!email) {
      console.error(`[OAuth] ID token missing email claim`);
      return new Response(
        `<html><body><h1>Error</h1><p>ID token missing email claim</p></body></html>`,
        { status: 400, headers: { "Content-Type": "text/html" } }
      );
    }

    console.log(`[OAuth] Decoded ID token: email=${email}, googleUserId=${googleUserId}`);

    // Step 2c: Find or create user
    let user = null;
    const { data: existingUser, error: lookupError } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (lookupError && lookupError.code !== "PGRST116") {
      throw new Error(`Database lookup failed: ${lookupError.message}`);
    }

    if (existingUser) {
      user = existingUser;
      console.log(`[OAuth] User already exists: ${user.id}`);
    } else {
      const { data: newUser, error: createError } = await supabase
        .from("users")
        .insert([{ email }])
        .select()
        .single();

      if (createError) {
        throw new Error(`Failed to create user: ${createError.message}`);
      }

      user = newUser;
      console.log(`[OAuth] Created new user: ${user.id}`);
    }

    // Step 2d: Upsert auth provider with tokens
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    const { data: provider, error: providerError } = await supabase
      .from("auth_providers")
      .upsert(
        {
          user_id: user.id,
          provider: "google",
          provider_user_id: googleUserId,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || null,
          expires_at: expiresAt.toISOString(),
        },
        { onConflict: "provider,provider_user_id" }
      )
      .select()
      .single();

    if (providerError) {
      throw new Error(`Failed to upsert auth provider: ${providerError.message}`);
    }

    console.log(`[OAuth] Upserted auth provider for user: ${user.id}, expires at: ${expiresAt.toISOString()}`);

    // Step 2e: Create session
    const sessionToken = generateSessionToken();
    const sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .insert([
        {
          user_id: user.id,
          session_token: sessionToken,
          expires_at: sessionExpiresAt.toISOString(),
        },
      ])
      .select()
      .single();

    if (sessionError) {
      throw new Error(`Failed to create session: ${sessionError.message}`);
    }

    console.log(`[OAuth] Created session: ${session.id}, expires in 7 days`);

    // Step 2f: Redirect to frontend with session token
    return new Response(null, {
      status: 302,
      headers: {
        "Location": `http://localhost:5173?token=${sessionToken}`,
      },
    });
  } catch (error) {
    console.error(`[OAuth] Callback error: ${String(error)}`);
    return new Response(
      `<html><body><h1>Error</h1><p>${String(error)}</p></body></html>`,
      {
        status: 500,
        headers: { "Content-Type": "text/html" },
      }
    );
  }
});

/**
 * Decode Google ID token (JWT) - Edge Runtime Compatible
 * Uses Web APIs (atob) instead of Node.js Buffer
 * In production, consider using @google-auth-library/oauth2-client for full verification
 */
function decodeIdToken(idToken: string): { email: string; sub: string; picture?: string; name?: string } {
  try {
    const parts = idToken.split(".");
    if (parts.length !== 3) {
      throw new Error("Invalid ID token format: JWT must have 3 parts");
    }

    // JWT uses Base64URL encoding, need to convert to standard Base64
    // Replace URL-safe chars: - becomes +, _ becomes /
    let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");

    // Pad to multiple of 4 if needed
    while (base64.length % 4) {
      base64 += "=";
    }

    // Decode using Web API (Edge-safe)
    const jsonString = atob(base64);

    // Parse UTF-8 encoded JSON
    const payload = JSON.parse(jsonString);

    if (!payload.email || !payload.sub) {
      throw new Error("ID token missing required claims: email or sub");
    }

    console.log(`[OAuth] Decoded ID token for: ${payload.email}`);

    return {
      email: payload.email,
      sub: payload.sub,
      picture: payload.picture,
      name: payload.name,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to decode ID token: ${errorMsg}`);
  }
}

/**
 * Generate a secure session token
 */
function generateSessionToken(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback
  return `sess_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;
}

/**
 * Generate random state for CSRF protection
 */
function generateRandomState(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let state = "";
  for (let i = 0; i < 32; i++) {
    state += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return state;
}
