# 🚀 MCP Setup Guide - Step 7

## Overview
Implemented 5 specialized MCP (Model Context Protocol) prompts integrated with the Gmail sync pipeline and Gemini API.

---

## ✅ Completed Components

### 1. **Persona Generator** (`/mcp/persona`)
**Purpose:** Generate detailed insurance user persona from email history

**Request:**
```json
{
  "user_id": "609ab060-cf41-4d83-a7fc-a4dab9aa22ad"
}
```

**Response:**
```json
{
  "status": "success",
  "persona": {
    "profile_name": "Conservative Investor",
    "insurance_types": ["Life", "Health"],
    "estimated_age_group": "35-45",
    "risk_profile": "conservative",
    "engagement_level": "high",
    "key_concerns": ["coverage adequacy", "affordability"],
    "estimated_annual_premium": 5000,
    "policy_count": "3"
  },
  "reasoning": "Generated from 20 insurance emails"
}
```

**Implementation:**
- Fetches last 20 insurance-related emails
- Sends to Gemini API for persona analysis
- Stores result in `personas` table for caching
- Returns structured profile with insurance preferences

---

### 2. **Policy Analyzer** (`/mcp/policy`)
**Purpose:** Deep analysis of policy documents and terms

**Request:**
```json
{
  "user_id": "609ab060-cf41-4d83-a7fc-a4dab9aa22ad",
  "email_id": "optional_specific_email_id"
}
```

**Response:**
```json
{
  "status": "success",
  "policies": [
    {
      "policy_number": "POL123456",
      "type": "Life Insurance",
      "provider": "HDFC Life",
      "coverage_amount": "₹50 lakhs",
      "renewal_date": "2024-06-30",
      "status": "active"
    }
  ],
  "compliance_score": 85,
  "recommendations": [
    "Consider increasing health insurance coverage",
    "Review beneficiary designations"
  ]
}
```

**Implementation:**
- Analyzes policy communications (subject, content)
- Extracts policy details using Gemini
- Scores coverage compliance (0-100)
- Lists actionable recommendations

---

### 3. **Risk Assessment** (`/mcp/risk`)
**Purpose:** Evaluate user's risk profile based on email patterns and claims

**Request:**
```json
{
  "user_id": "609ab060-cf41-4d83-a7fc-a4dab9aa22ad"
}
```

**Response:**
```json
{
  "status": "success",
  "risk_score": 35,
  "risk_level": "low",
  "risk_factors": [
    {
      "factor": "Claim frequency",
      "severity": "low",
      "description": "2 claims filed in past year - within normal range"
    }
  ],
  "mitigation_strategies": [
    "Maintain current coverage levels",
    "Review preventive health measures",
    "Schedule annual policy review"
  ]
}
```

**Implementation:**
- Analyzes claim frequency from email patterns
- Evaluates portfolio diversity
- Identifies risk gaps
- Suggests mitigation strategies
- Returns risk score (0-100) + risk level categorization

---

### 4. **Recommendation Engine** (`/mcp/recommend`)
**Purpose:** Generate personalized insurance recommendations

**Request:**
```json
{
  "user_id": "609ab060-cf41-4d83-a7fc-a4dab9aa22ad",
  "context": "Looking to optimize insurance premiums (optional)"
}
```

**Response:**
```json
{
  "status": "success",
  "recommendations": [
    {
      "title": "Bundle Life and Health Insurance",
      "category": "savings",
      "description": "Combining policies can save 15-20% on premiums",
      "estimated_benefit": "₹5,000-8,000 annual savings",
      "priority": "high",
      "action_items": [
        "Get quotes from bundled plans",
        "Compare coverage limits",
        "Review deductibles"
      ],
      "expected_timeline": "30 days"
    }
  ],
  "overall_priority": "high",
  "estimated_total_impact": "Save 15-20% on premiums"
}
```

**Implementation:**
- Analyzes current portfolio
- Identifies optimization opportunities
- Categorizes: coverage | optimization | savings | compliance
- Prioritizes by impact and urgency
- Provides specific action items with timelines

---

### 5. **Conversation Simulator** (`/mcp/chat`)
**Purpose:** AI customer service conversations about insurance

**Request (Single-turn):**
```json
{
  "user_id": "609ab060-cf41-4d83-a7fc-a4dab9aa22ad",
  "message": "I'm having trouble understanding my policy renewal terms",
  "history": []
}
```

**Request (Multi-turn):**
```json
{
  "user_id": "609ab060-cf41-4d83-a7fc-a4dab9aa22ad",
  "message": "The renewal premium increased by 20%. Is that normal?",
  "history": [
    {"role": "user", "content": "I'm having trouble understanding my policy renewal terms"},
    {"role": "agent", "content": "I'd be happy to help! Policy renewal terms can be complex..."}
  ]
}
```

**Response:**
```json
{
  "status": "success",
  "agent_response": "A 20% increase is on the higher side, but can be normal due to several factors like age-related risk increase, claims history, or market conditions...",
  "suggested_actions": [
    "Review quote from alternative providers",
    "Discuss premium increase with agent",
    "Evaluate coverage needs"
  ],
  "sentiment": "neutral"
}
```

**Implementation:**
- Maintains conversation history
- Contextualizes with user's insurance portfolio
- Generates empathetic, helpful responses
- Detects sentiment (positive|neutral|negative|frustrated)
- Flags cases requiring escalation

---

## 📊 Technical Architecture

### File Structure
```
convex/
├── mcp/
│   ├── index.ts              # HTTP route handlers for all 5 prompts
│   ├── personaGenerator.ts    # Prompt 1
│   ├── policyAnalyzer.ts      # Prompt 2
│   ├── riskAssessment.ts      # Prompt 3
│   ├── recommendationEngine.ts # Prompt 4
│   └── conversationSimulator.ts # Prompt 5
└── http.js                    # Updated with 5 new routes
```

### API Endpoints
| Prompt | Method | Path | Request | Response |
|--------|--------|------|---------|----------|
| Persona | POST | `/mcp/persona` | `{user_id}` | `{status, persona, reasoning}` |
| Policy | POST | `/mcp/policy` | `{user_id, email_id?}` | `{status, policies[], compliance_score}` |
| Risk | POST | `/mcp/risk` | `{user_id}` | `{status, risk_score, risk_level}` |
| Recommend | POST | `/mcp/recommend` | `{user_id, context?}` | `{status, recommendations[], priority}` |
| Chat | POST | `/mcp/chat` | `{user_id, message, history?}` | `{status, agent_response, sentiment}` |

### Integration Points
- **Gmail Sync:** Uses 10-day email history
- **Supabase:** Reads from `emails` table, writes to `personas` table
- **Gemini API:** Powers all 5 prompts with structured JSON responses
- **HTTP Router:** All endpoints exposed via Convex `httpRouter`

---

## 🧪 Testing with Postman

### Setup
1. **Import Collection:**
   - Download: `MCP_Prompts_Test_Collection.postman_collection.json`
   - Open Postman → File → Import
   - Select downloaded file

2. **Replace User ID:**
   - In each request, replace `user_id` with actual user from Supabase
   - Or use: `609ab060-cf41-4d83-a7fc-a4dab9aa22ad` (from earlier tests)

3. **Verify Endpoints:**
   - Base URL: `https://hushed-magpie-545.convex.cloud`
   - All endpoints are POST (except health check)

### Test Sequence

#### Test 1️⃣: Persona Generator
```bash
POST /mcp/persona
Body: {"user_id": "609ab060-cf41-4d83-a7fc-a4dab9aa22ad"}
```
**Expected:** Returns persona profile with insurance types, risk profile, engagement level

#### Test 2️⃣: Policy Analyzer
```bash
POST /mcp/policy
Body: {"user_id": "609ab060-cf41-4d83-a7fc-a4dab9aa22ad"}
```
**Expected:** Lists extracted policies, compliance score, recommendations

#### Test 3️⃣: Risk Assessment
```bash
POST /mcp/risk
Body: {"user_id": "609ab060-cf41-4d83-a7fc-a4dab9aa22ad"}
```
**Expected:** Risk score (0-100), risk level, mitigation strategies

#### Test 4️⃣: Recommendation Engine
```bash
POST /mcp/recommend
Body: {
  "user_id": "609ab060-cf41-4d83-a7fc-a4dab9aa22ad",
  "context": "Looking to reduce premiums"
}
```
**Expected:** Prioritized recommendations with action items and timelines

#### Test 5️⃣: Conversation Simulator (Single-turn)
```bash
POST /mcp/chat
Body: {
  "user_id": "609ab060-cf41-4d83-a7fc-a4dab9aa22ad",
  "message": "How do I file a claim?",
  "history": []
}
```
**Expected:** Natural conversational response with sentiment and suggested actions

#### Test 6️⃣: Conversation Simulator (Multi-turn)
```bash
POST /mcp/chat
Body: {
  "user_id": "609ab060-cf41-4d83-a7fc-a4dab9aa22ad",
  "message": "Is there a waiting period?",
  "history": [
    {"role": "user", "content": "How do I file a claim?"},
    {"role": "agent", "content": "To file a claim, you can call our hotline..."}
  ]
}
```
**Expected:** Contextual response building on conversation history

---

## ✨ Key Features

### 1. **Deterministic Classification**
- Uses 2-stage pipeline (deterministic + Gemini fallback)
- 10-day email history window
- Only stores insurance-related emails

### 2. **Idempotency**
- Uses `gmail_message_id` as unique constraint
- Persona generator uses `upsert` on user_id
- Safe to call multiple times without duplication

### 3. **Type Safety**
- Full TypeScript with proper types
- Gemini responses validated as JSON
- Error handling with descriptive messages

### 4. **Scalability**
- Limits queries (last 20-30 emails per prompt)
- Caches personas for quick re-retrieval
- Efficient Gemini API calls (single prompt per endpoint)

### 5. **Explainability**
- Returns `reasoning` field explaining data source
- Logs confidence scores
- Provides specific `suggested_actions`

---

## 🔧 Troubleshooting

### Issue: "Gemini API key not configured"
**Solution:** Set env var in Convex dashboard
```bash
npx convex env set GEMINI_API_KEY "your-key-here"
```

### Issue: "Failed to fetch emails"
**Solution:** Ensure user has insurance emails in database
```sql
SELECT COUNT(*) FROM emails 
WHERE user_id = '609ab060-cf41-4d83-a7fc-a4dab9aa22ad' 
AND is_insurance_related = true;
```

### Issue: Gemini JSON parse error
**Solution:** Check Gemini API response format
- Verify API key is active
- Check quotas in Google Cloud Console
- Ensure model is `gemini-pro` (not gemini-1.5)

### Issue: 404 on MCP endpoints
**Solution:** Verify deployment was successful
```bash
npx convex deploy --yes  # Redeploy
```

---

## 📈 Next Steps (Optional Enhancements)

1. **Caching Layer:** Redis for frequently accessed personas
2. **Rate Limiting:** Protect against API abuse
3. **Analytics:** Track which prompts are most used
4. **A/B Testing:** Compare Gemini vs Claude responses
5. **Fine-tuning:** Custom Gemini models for insurance domain
6. **Feedback Loop:** User feedback → model retraining

---

## 📋 Summary

| Component | Status | Endpoint | Purpose |
|-----------|--------|----------|---------|
| Persona Generator | ✅ | `/mcp/persona` | User profile from emails |
| Policy Analyzer | ✅ | `/mcp/policy` | Policy extraction & analysis |
| Risk Assessment | ✅ | `/mcp/risk` | Risk scoring & mitigation |
| Recommendation Engine | ✅ | `/mcp/recommend` | Personalized suggestions |
| Conversation Simulator | ✅ | `/mcp/chat` | AI customer service |
| Postman Tests | ✅ | Collection file | 6 test scenarios |
| Deployment | ✅ | Convex prod | All endpoints live |

All systems deployed and ready for testing! 🚀
