# Agent Insure

**Agent Insure** is a next-generation AI-powered insurance assistant designed to help users manage policies, analyze risks, and sync communication seamlessly. It combines a modern, responsive frontend with a robust serverless backend powered by **Convex** and **Google Gemini** for intelligent reasoning.

![Agent Insure Logo](./insurance-agent-frontend/public/logo.svg)

## 🚀 Key Features

*   **Smart Chat Interface**: Interact with "Agent Insure" for real-time advice on coverage, claims, and renewals.
*   **Gmail Integration**: Securely sync and analyze insurance-related emails directly from your inbox.
*   **Intelligent Analysis**:
    *   **Policy Analyzer**: Extracts key details from policy documents.
    *   **Risk Assessment**: Identifies coverage gaps based on user profile and assets.
    *   **Recommendations**: Suggests optimized insurance products.
*   **MCP (Model Context Protocol) Implementation**: Custom agentic workflow for fetching, classifying, and processing data.
*   **Secure Authentication**: Google Sign-In powered by Supabase and Convex.
*   **Deterministic Logic Core**: Built on a foundation of verifiable rules, not just generative guesses.

## 🛠️ Tech Stack

### Frontend
*   **Framework**: React (Vite)
*   **Styling**: Vanilla CSS (Custom "Deep Space" Dark Theme)
*   **State Management**: React Hooks + LocalStorage Persistence
*   **Icons**: Lucide React

### Backend
*   **Platform**: [Convex](https://www.convex.dev/) (Real-time database & backend functions)
*   **AI Model**: Google Gemini Pro (via `@google/generative-ai`)
*   **Auth**: Supabase (integrated with Convex)
*   **Language**: TypeScript

## 📂 Project Structure

```
d:/Insurance Agent
├── insurance-agent-frontend/   # React + Vite Application
│   ├── src/components/         # ChatInterface, LandingPage, etc.
│   └── ...
├── insurance-agent-backend/    # Convex Backend Functions
│   ├── convex/                 # API endpoints, schema, and actions
│   └── ...
└── MCP_SETUP_COMPLETE_GUIDE.md # Documentation for MCP Agent setup
```

## ⚡ Getting Started

### Prerequisites
*   Node.js (v18+)
*   npm or yarn
*   A Convex account
*   Google/Supabase credentials (for Auth)

### 1. Backend Setup

Initialize the functionality engine first.

```bash
cd insurance-agent-backend

# Install dependencies
npm install

# Initialize Convex
npx convex dev
```

*Create a `.env.local` file in `insurance-agent-backend` with your credentials:*
```env
# Deployment
CONVEX_DEPLOYMENT=... 
CONVEX_URL=...

# Auth & AI
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GEMINI_API_KEY=...
```

### 2. Frontend Setup

Launch the user interface.

```bash
cd insurance-agent-frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

Visit `http://localhost:5173` to open the application.

## 🧪 Testing

To view backend logs and debug AI agents:
```bash
# In insurance-agent-backend directory
npx convex logs
```

## 📄 License
Private / Proprietary
