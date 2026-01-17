import { httpAction } from "../_generated/server";
import { getSupabaseClient, User, AuthProvider, Session } from "../utils/supabase";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing required Supabase environment variables");
}

const supabase = getSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Decode Google ID token - Edge Runtime Compatible
 * Uses Web APIs (atob) instead of Node.js Buffer
 * For production, consider @google-auth-library/oauth2-client for full verification
 */
function decodeGoogleIdToken(idToken: string) {
  try {
    const parts = idToken.split(".");
    if (parts.length !== 3) {
      throw new Error("Invalid ID token format: JWT must have 3 parts");
    }

    // Convert Base64URL to standard Base64
    let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");

    // Pad to multiple of 4
    while (base64.length % 4) {
      base64 += "=";
    }

    // Decode using Web API (Edge-safe)
    const jsonString = atob(base64);
    const decoded = JSON.parse(jsonString);

    return {
      email: decoded.email,
      sub: decoded.sub, // Google's unique user ID
      picture: decoded.picture,
      name: decoded.name,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to decode ID token: ${errorMsg}`);
  }
}

/**
 * Google OAuth Callback Handler
 * Expects: idToken, accessToken, refreshToken (optional), expiresIn
 */
export const googleCallback = httpAction(async (_ctx: any, request: Request) => {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await request.json()) as {
      idToken: string;
      accessToken: string;
      refreshToken?: string;
      expiresIn?: number;
    };
    const { idToken, accessToken, refreshToken, expiresIn } = body;

    if (!idToken || !accessToken) {
      return new Response(
        JSON.stringify({ error: "Missing idToken or accessToken" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Decode the ID token
    const tokenPayload = decodeGoogleIdToken(idToken);
    const { email, sub: googleUserId } = tokenPayload;

    console.log(`[OAuth] Processing callback for email: ${email}`);

    // Find or create user by email
    let user: User | null = null;
    const { data: existingUser, error: lookupError } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (lookupError && lookupError.code !== "PGRST116") {
      throw new Error(`Database lookup failed: ${lookupError.message}`);
    }

    if (existingUser) {
      user = existingUser as User;
      console.log(`[OAuth] Reusing existing user: ${user.id}`);
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabase
        .from("users")
        .insert([{ email }])
        .select()
        .single();

      if (createError) {
        throw new Error(`Failed to create user: ${createError.message}`);
      }

      user = newUser as User;
      console.log(`[OAuth] Created new user: ${user.id} for email: ${email}`);
    }

    // Upsert auth provider
    const expiresAt = new Date(Date.now() + (expiresIn || 3600) * 1000);
    const { data: provider, error: providerError } = await supabase
      .from("auth_providers")
      .upsert(
        {
          user_id: user.id,
          provider: "google",
          provider_user_id: googleUserId,
          access_token: accessToken,
          refresh_token: refreshToken || null,
          expires_at: expiresAt.toISOString(),
        },
        { onConflict: "provider,provider_user_id" }
      )
      .select()
      .single();

    if (providerError) {
      throw new Error(`Failed to upsert provider: ${providerError.message}`);
    }

    console.log(`[OAuth] Upserted auth provider for user: ${user.id}`);

    // Create session
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

    console.log(`[OAuth] Created session: ${session?.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        sessionToken,
        user: {
          id: user.id,
          email: user.email,
        },
        provider: {
          provider: "google",
          expiresAt: expiresAt.toISOString(),
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error(`[OAuth] Error: ${String(error)}`);
    return new Response(
      JSON.stringify({
        error: "OAuth callback failed",
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
 * Validate Session Token
 * Expects: Authorization: Bearer <sessionToken>
 */
export const validateSession = httpAction(async (_ctx: any, request: Request) => {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid Authorization header" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const sessionToken = authHeader.substring(7);

    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("*")
      .eq("session_token", sessionToken)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: "Invalid session token" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check if session expired
    if (new Date(session.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Session expired" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get user data
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", session.user_id)
      .single();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        valid: true,
        user: {
          id: user.id,
          email: user.email,
        },
        session: {
          expiresAt: session.expires_at,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error(`[Auth] Validation error: ${String(error)}`);
    return new Response(
      JSON.stringify({ error: "Validation failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

/**
 * Get Current User Profile
 * Expects: Authorization: Bearer <sessionToken>
 */
export const getMe = httpAction(async (_ctx: any, request: Request) => {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const sessionToken = authHeader.substring(7);

    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("*")
      .eq("session_token", sessionToken)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: "Invalid session" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", session.user_id)
      .single();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get auth providers for this user
    const { data: providers, error: providersError } = await supabase
      .from("auth_providers")
      .select("provider,expires_at")
      .eq("user_id", user.id);

    if (providersError) {
      console.warn(`[Auth] Failed to fetch providers: ${providersError.message}`);
    }

    return new Response(
      JSON.stringify({
        user: {
          id: user.id,
          email: user.email,
          createdAt: user.created_at,
        },
        providers: providers || [],
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
      }
    );
  } catch (error) {
    console.error(`[Auth] GetMe error: ${String(error)}`);
    return new Response(
      JSON.stringify({ error: "Failed to get user profile" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  }
});

/**
 * Generate a secure session token
 */
function generateSessionToken(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return `sess_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;
}
