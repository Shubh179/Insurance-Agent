# Insurance Agent Backend

AI-powered insurance email analysis system with Gmail integration, MCP prompts, and Gemini AI classification.

## 🚀 Features

- **Gmail OAuth Integration** - Sync emails from Gmail with Google OAuth 2.0
- **AI Email Classification** - Deterministic rules + Gemini AI fallback for insurance email detection
- **MCP Prompts (5 Routes)** - Insurance persona, policy analysis, risk assessment, recommendations, conversational AI
- **Supabase Database** - PostgreSQL backend for users, emails, and sessions
- **Convex Backend** - Real-time functions with TypeScript
- **Gemini 2.5 Flash** - Latest Google AI model for email validation and analysis

## 📋 Tech Stack

- **Backend**: Convex (TypeScript)
- **Database**: Supabase (PostgreSQL)
- **AI**: Google Gemini 2.5 Flash
- **Auth**: Google OAuth 2.0
- **Email API**: Gmail API

## 🔧 Environment Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables

Create `.env.local`:
```env
# Convex
CONVEX_DEPLOYMENT=dev:your-deployment-name

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Gemini AI
GEMINI_API_KEY=your_gemini_api_key

# Google OAuth
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
```

### 3. Deploy to Convex
```bash
npx convex dev        # Development
npx convex deploy     # Production
```

## 🌐 API Endpoints

### Authentication
- `GET /auth/google` - Start Google OAuth flow
- `GET /auth/google/callback` - OAuth callback handler
- `POST /auth/session` - Validate session token

### Gmail Sync
- `POST /gmail/sync` - Sync last 10 days of Gmail emails
  ```json
  Headers: { "Authorization": "Bearer <session_token>" }
  ```

### MCP Routes (AI Analysis)

#### 1. Persona Generator
```http
POST /mcp/persona
Body: { "user_id": "uuid" }
```
Returns insurance user profile (engagement level, insurance types, risk profile)

#### 2. Policy Analyzer
```http
POST /mcp/policy
Body: { "user_id": "uuid", "email_id": "uuid" }
```
Returns policy details, compliance score, coverage gaps

#### 3. Risk Assessment
```http
POST /mcp/risk
Body: { "user_id": "uuid" }
```
Returns risk score (0-100), risk level, mitigation strategies

#### 4. Recommendation Engine
```http
POST /mcp/recommend
Body: { "user_id": "uuid", "context": "optional" }
```
Returns personalized insurance recommendations

#### 5. Conversation Simulator
```http
POST /mcp/chat
Body: { 
  "user_id": "uuid",
  "message": "What's my coverage?",
  "history": []  // optional
}
```
Returns AI agent response, suggested actions, sentiment

## 🧠 Email Classification System

### Deterministic Rules (Stage 1)
**Scoring System:**
- Policy number detected: +5
- Insurance keywords in subject: +2
- Claim lifecycle terms: +3
- Insurance provider match: +2
- Regulatory phrases: +1

**Thresholds:**
- Score ≥ 6: Insurance email (accepted)
- Score ≤ 2: Not insurance (rejected)
- Score 3-5: Borderline → Gemini validation

### Supported Insurance Providers
- LIC
- HDFC Life
- ICICI Lombard
- Bajaj Allianz
- Tata AIG
- Max Life

### Gemini AI Fallback (Stage 2)
Validates borderline emails with confidence scoring.

## 📊 Database Schema

### Users Table
```sql
users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE,
  name TEXT,
  created_at TIMESTAMP
)
```

### Emails Table
```sql
emails (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  gmail_message_id TEXT UNIQUE,
  sender TEXT,
  subject TEXT,
  raw_snippet TEXT,
  body TEXT,
  is_insurance_related BOOLEAN,
  is_spam BOOLEAN,
  category TEXT,
  confidence NUMERIC,
  classified_by TEXT CHECK (IN ('rules', 'rules+ai')),
  received_at TIMESTAMP
)
```

### Sessions Table
```sql
sessions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  session_token TEXT UNIQUE,
  expires_at TIMESTAMP
)
```

## 🔐 OAuth Flow

1. User clicks "Login with Google"
2. Redirected to `/auth/google`
3. Google consent screen
4. Callback to `/auth/google/callback`
5. Create/update user, session, and auth_provider
6. Auto-sync last 10 days of emails
7. Return session token + redirect URL

## 🛠️ Development

### Watch Logs
```bash
cd insurance-agent-backend
npx convex logs
```

### Deploy Functions
```bash
npx convex deploy --yes
```

### Set Environment Variables
```bash
npx convex env set GEMINI_API_KEY "your_key"
npx convex env set SUPABASE_URL "your_url"
```

## 📝 Project Structure

```
insurance-agent-backend/
├── convex/
│   ├── auth/          # OAuth handlers
│   ├── gmail/         # Email sync logic
│   ├── mcp/           # AI analysis routes
│   ├── utils/         # Email filter, Supabase client
│   ├── http.ts        # HTTP router
│   └── _generated/    # Convex generated files
├── cloudflare-workers/
│   └── mcp-persona.js # Cloudflare MCP worker
├── .env.local         # Environment variables
├── package.json
└── README.md
```

## 🚀 Deployment

**Dev Environment:**
- Convex Site: `https://greedy-nightingale-153.convex.site`
- Deployment: `dev:greedy-nightingale-153`

**Production Environment:**
- Convex Cloud: `https://hushed-magpie-545.convex.cloud`
- Deployment: `prod:hushed-magpie-545`

## 🧪 Testing

### Test Gmail Sync
```bash
# Login and sync
curl https://your-deployment.convex.site/auth/google
```

### Test MCP Routes
```bash
# Persona
curl -X POST https://your-deployment.convex.site/mcp/persona \
  -H "Content-Type: application/json" \
  -d '{"user_id":"uuid"}'

# Chat
curl -X POST https://your-deployment.convex.site/mcp/chat \
  -H "Content-Type: application/json" \
  -d '{"user_id":"uuid","message":"What is my coverage?"}'
```

## 📜 License

MIT

## 👤 Author

Shubh Shah

## 🔗 Repository

https://github.com/Shubh179/Insurance-Agent
