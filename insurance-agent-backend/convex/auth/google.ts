import { httpAction } from "../_generated/server";
import { getSupabaseClient } from "../utils/supabase";

const generateSessionToken = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const getSupabase = () => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in Convex env");
  }

  return getSupabaseClient(supabaseUrl, supabaseKey);
};

// POST /auth/google/mock
// Mock Google OAuth exchange. Accepts email, googleId, accessToken, refreshToken, expiresIn (seconds)
export const mockGoogleAuth = httpAction(async (ctx, request) => {
  try {
    const supabase = getSupabase();

    const body = (await request.json()) as {
      email?: string;
      googleId?: string;
      accessToken?: string;
      refreshToken?: string;
      expiresIn?: number;
    };

    const { email, googleId, accessToken, refreshToken, expiresIn } = body;

    if (!email || !googleId || !accessToken) {
      return new Response(
        JSON.stringify({
          error: "email, googleId, and accessToken are required",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const expiresAt = new Date(Date.now() + (expiresIn ?? 3600) * 1000).toISOString();

    // Upsert user
    const { data: user, error: userError } = await supabase
      .from("users")
      .upsert(
        {
          email,
          google_id: googleId,
          access_token: accessToken,
          refresh_token: refreshToken ?? null,
        },
        { onConflict: "email" }
      )
      .select()
      .single();

    if (userError || !user) {
      return new Response(
        JSON.stringify({
          error: userError?.message ?? "Failed to upsert user",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Create session
    const sessionToken = generateSessionToken();
    const { error: sessionError } = await supabase.from("sessions").insert({
      user_id: user.id,
      session_token: sessionToken,
      expires_at: expiresAt,
    });

    if (sessionError) {
      return new Response(
        JSON.stringify({
          error: sessionError.message,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        status: "success",
        sessionToken,
        user: {
          id: user.id,
          email: user.email,
          googleId: user.google_id,
        },
        expiresAt,
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});

// GET /auth/session
// Validate session token sent as Bearer token
export const validateSession = httpAction(async (ctx, request) => {
  try {
    const supabase = getSupabase();

    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization bearer token" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("session_token, user_id, expires_at, created_at")
      .eq("session_token", token)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: "Invalid session" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (new Date(session.expires_at).getTime() < Date.now()) {
      return new Response(
        JSON.stringify({ error: "Session expired" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, email, google_id, created_at, updated_at")
      .eq("id", session.user_id)
      .single();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        status: "valid",
        session: {
          token: session.session_token,
          expiresAt: session.expires_at,
        },
        user,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
