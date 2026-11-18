# Agent Insure codebase

Agent Insure is an insurance assistant that signs users in with Google, syncs Gmail, classifies insurance-related messages, and uses those messages to answer questions and generate assessments. The React frontend calls a Convex HTTP API. Supabase Postgres stores the app's users, sessions, and synced data. Google provides OAuth and Gmail. Groq provides model inference.

## Repository map

| Area | Role |
| --- | --- |
| [insurance-agent-frontend](insurance-agent-frontend/) | React 19, React Router 7, Vite 7, Lucide icons, and plain CSS. `src/main.jsx` boots the app, `src/App.jsx` defines routes and handles OAuth returns, and `src/components/` contains the landing page and chat. `public/` holds the images and hero video. |
| [convex/http.ts](insurance-agent-backend/convex/http.ts) | Active API route registry. Wires HTTP actions and dispatches the five `/mcp/*` operations to internal Convex actions. |
| [convex/auth](insurance-agent-backend/convex/auth/) and [convex/gmail](insurance-agent-backend/convex/gmail/) | Google OAuth, app-session validation, profile lookup, Gmail sync, and saved email reads. |
| [convex/utils](insurance-agent-backend/convex/utils/) | Supabase client, CORS and rate-limiting helpers, and the shared email classifier. |
| [convex/agents](insurance-agent-backend/convex/agents/), [convex/insurance](insurance-agent-backend/convex/insurance/), and [convex/agent](insurance-agent-backend/convex/agent/) | Insurance email aggregation and environment profiling, with HTTP wrappers for both. |
| [convex/mcp](insurance-agent-backend/convex/mcp/) | Persona generation, policy analysis, risk assessment, recommendations, and chat. The registered handlers are JSON HTTP endpoints under the project's MCP naming. |
| [Production SQL](insurance-agent-backend/supabase_schema_production.sql) and [migrations](insurance-agent-backend/migrations/) | Supabase schema for fresh setup and a separate migration for the older email schema. |
| [Cloudflare worker](insurance-agent-backend/cloudflare-workers/) | Standalone persona implementation and PowerShell setup script. The React app calls the Convex persona route. |
| [MCP guide](MCP_SETUP_COMPLETE_GUIDE.md) and [Postman collection](MCP_Prompts_Test_Collection.postman_collection.json) | Manual examples and requests for the agent endpoints. Use the route and action source for the current request contract. |

## Main workflows

The landing page’s **About** link opens the public `/branding` route. The branding page describes Agent Insure, explains its use of Google access, and provides a support contact.

1. **Sign in.** The landing page sends the browser to `GET /auth/google`. The handlers in `auth/realoauth.ts` exchange the authorization code, fetch the Google profile, save the user and Google provider credentials, and create an app session. The callback redirects to the frontend with a `token` query parameter. `App.jsx` stores it as `session_token` in local storage, removes the query string, and navigates to `/chat`. The browser route guard checks for token presence. The API validates the session, and chat loads the profile through `GET /me`.
2. **Sync Gmail.** The chat sends a bearer-authenticated request to `POST /gmail/sync`. `gmail/syncreal.ts` checks the session, retrieves the Google credentials from Supabase, refreshes the access token when needed, and fetches recent Gmail messages. It extracts message content, calls `utils/emailFilter.ts`, and upserts rows into Supabase by `gmail_message_id`. Classification combines spam checks and deterministic scoring with a Groq fallback for borderline messages.
3. **Analyze and chat.** The chat's suggestion cards call the policy, risk, persona, recommendation, or chat endpoint. Free-form chat sends the current message and prior turns. The router checks the bearer session and rate limit before invoking the internal action. The actions look up relevant email data by user and call Groq. The frontend formats returned results and keeps the active conversation in React state.
4. **Summarize.** `insurance/summary.ts` exposes email-derived insurance counts and summaries from `agents/insuranceAnalyzer.ts`. `agent/environment.ts` exposes a profile built from deterministic aggregates and Groq-generated interpretation in `agents/environmentAgent.ts`.

## HTTP routes

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/health` | Backend health |
| GET | `/auth/google`, `/auth/google/callback` | Start and finish Google OAuth |
| GET | `/auth/session`, `/me` | Validate a session and retrieve the current profile |
| POST | `/gmail/sync` | Fetch, classify, and save Gmail messages |
| GET | `/gmail/emails`, `/gmail/stats` | List saved mail and retrieve aggregate stats |
| GET | `/gmail/emails/:messageId` | Single-message handler. The router registers this string as a literal `path`. Check parameter routing before relying on substituted IDs. |
| POST | `/emails/filter` | Classify a supplied email |
| GET | `/insurance/summary`, `/agent/environment` | Insurance summary and environment profile |
| POST | `/mcp/persona`, `/mcp/policy`, `/mcp/risk` | Generate a persona, analyze policy information, or assess coverage gaps |
| POST | `/mcp/recommend`, `/mcp/chat` | Generate recommendations or answer a message with optional history |

The router also registers CORS preflight handlers for `/me`, Gmail sync, and the MCP endpoints. CORS origins are configured in `convex/utils/supabase.ts`.

## Storage and alternate implementations

- Supabase tables include `users`, `auth_providers`, `sessions`, `emails`, `personas`, `agent_logs`, and `rate_limits`. Review `migrations/alter_emails_schema.sql` when upgrading an older database. It migrates email columns and drops the former columns.
- `convex/schema.ts` separately declares Convex tables for users, emails, personas, agent logs, and health checks. `convex/queries/emails.ts` reads the Convex email table. The active Gmail sync and MCP actions read or write Supabase.
- The repository contains mock auth in `auth/google.ts`, other Gmail fetch and sync handlers in `gmail/`, database diagnostics in `endpoints/database.ts`, and a separate persona handler in `http_mcp_persona.ts`. Check `http.ts` when choosing which implementation to change. `convex/_generated/` contains Convex-generated interfaces.

## Development and deployment

Use a Node.js release supported by Vite 7. The local checks for this review used Node.js 24.

```powershell
# Backend terminal, from the repository root
cd insurance-agent-backend
npm install
npm run dev
```

```powershell
# Frontend terminal, from the repository root
cd insurance-agent-frontend
npm ci
npm run dev
```

- Use [the backend environment example](insurance-agent-backend/.env.example) for variable names. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GROQ_API_KEY` in the Convex environment that runs the HTTP actions. Keep credentials server-side. Apply the database schema in Supabase.
- Vite serves the frontend locally, usually on port 5173. The frontend currently hardcodes a deployed Convex HTTP origin. Google OAuth also hardcodes its callback and the Vercel frontend return URL in `auth/realoauth.ts`. To exercise sign-in end to end on a separate deployment, align those URLs with Google's registered redirect URI and the backend CORS origins.
- Frontend commands are `npm run lint`, `npm run build`, and `npm run preview`. [vercel.json](insurance-agent-frontend/vercel.json) rewrites routes to `index.html` so direct navigation to `/branding` and `/chat` works on Vercel. Deploy with `insurance-agent-frontend` as the Vercel project root.
- Backend `npm test` runs `tsc --noEmit`. The backend package defines `npm run deploy` as `convex deploy` and `npm run build` as `convex push`. Use the type check for local validation. For HTTP smoke tests, use the selected deployment's `.convex.site` origin. The checked-in `test-health.js` targets a different hardcoded deployment URL.

## Review status

- Backend TypeScript check passed.
- Frontend production build passed with Vite's `--configLoader runner` and a temporary output directory. The default config loader encountered a local write-permission error under `node_modules/.vite-temp`.
- Frontend lint reported seven unused bindings. Six are catch parameters in `ChatInterface.jsx` and one is the `onLogin` prop in `LandingPage.jsx`.
- Live OAuth, Gmail sync, Supabase, Groq, and deployment behavior were outside the local checks.
