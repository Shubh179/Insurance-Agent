# Insurance Agent Backend

A sophisticated backend for the Insurance Agent application, built with [Convex](https://convex.dev/) and powered by **Google Gemini Pro**.

## Key Features

### 1. Advanced Email Processing
- **Gmail Sync**: Fetches emails via Gmail API using OAuth2.
- **Hybrid Classification Engine**:
  - **Stage 1 (Deterministic)**: Rule-based scoring (0-10) using keyword weighting, negative filters, and "Strong Signal" enforcement.
  - **Stage 2 (AI Verification)**: Borderline cases (Score 3-5 or High Score without Strong Signal) are sent to **Gemini Pro** for strict validation.
- **Negative Filtering**: Strict exclusion of Mutual Funds, Stock Market (NSE/BSE), Loans, and Credit Reports to prevent false positives.
- **Full Body Analysis**: Analyzing the entire email body (not just snippet) for accurate context.

### 2. MCP (Model Context Protocol) Agents
Exposes specialized endpoints for AI agents to retrieve context:
- **Policy Analyzer** (`/mcp/policy`): Extracts structured policy details (Policy No, Sum Assured, Expiry).
- **Risk Assessment** (`/mcp/risk`): Evaluates user risk based on claim history and coverage gaps.
- **Recommendation Engine** (`/mcp/recommend`): Suggests optimizations and new coverages.
- **Persona Generator** (`/mcp/persona`): Builds a user profile based on email history.
- **Chat Simulator** (`/mcp/chat`): Context-aware chat agent for customer interaction.

All agents use the **Full Email Body** for deep analysis.

### 3. Database
- **Supabase**: Relational storage for Users, Emails, Policies, and Sessions.
- **Convex**: Real-time backend functions and API hosting.

## Environment Variables

Ensure these are set in your Convex Dashboard:
- `GEMINI_API_KEY`: Google Gemini Pro API Key.
- `SUPABASE_URL`: Supabase Project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for backend access.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: For Gmail OAuth.

## Deployment

### Development
Sync changes to your dev environment:
```bash
npx convex dev
```

### Production
Deploy to production:
```bash
npx convex deploy
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/gmail/sync` | Trigger incremental email fetch & classification |
| POST | `/mcp/policy` | Run Policy Analysis Agent |
| POST | `/mcp/risk` | Run Risk Assessment Agent |
| POST | `/mcp/recommend` | Run Recommendation Agent |
| GET | `/insurance/summary` | Get aggregated dashboard metrics |
