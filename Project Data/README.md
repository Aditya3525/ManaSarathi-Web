# ManaSarathi

An AI-powered comprehensive mental wellbeing platform designed to provide personalized support, mood tracking, clinical assessments, and professional oversight.

This repository is a monorepo containing the web frontend, the backend API, and a mobile application (the mobile application is maintained separately in the `mobile` directory).

## 🚀 Project Overview

ManaSarathi bridges the gap between self-care and professional mental health support. By leveraging AI, the platform provides real-time empathetic conversations, tracking emotional progress over time, and delivering personalized mindfulness and cognitive behavioral therapy (CBT) resources.

### Core Architecture & Modules

#### 1. AI & Conversational Engine
- **Chatbot System**: Context-aware conversational agent using a multi-provider LLM approach (Gemini, OpenAI, Anthropic, Hugging Face).
- **Conversation Memory**: Tracks long-term emotional patterns, important moments, action items, and therapeutic goals.
- **Crisis Detection**: Analyzes sentiment and keywords to detect potential crises and escalate or provide emergency grounding exercises.

#### 2. Clinical Assessments
- **Robust Assessment Engine**: Configurable, standardized mental health assessments.
- **Insights & Scoring**: Generates wellness scores and AI-powered insights tracking long-term trends and shifts in well-being.

#### 3. Daily Tracking & Reflection
- **Mood & Sleep**: Granular mood logging with triggers and intensity, paired with sleep hygiene logs.
- **Journaling & Habits**: Reflective journal entries with AI pattern summaries, daily intention setting, gratitude logs, and habit streaks.

#### 4. Content & Practices
- **Multimedia Resources**: Articles, video, audio meditations, breathing exercises, and yoga sequences.
- **Personalized Recommendations**: Engine to suggest practices based on the user's current mood, previous engagements, and clinical assessment results.

#### 5. Admin & Therapist Portals
- **Therapist Oversight**: Interfaces for clinicians to view patient progress, manage bookings, and leave clinical notes safely.
- **Content Management**: An admin dashboard to curate content, update assessment questions, and handle platform analytics.

## 🛠 Tech Stack

### Frontend
- **Framework**: React 18 with Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS & Radix UI (accessible, unstyled components)
- **State Management**: Zustand & React Context
- **Routing**: React Router

### Backend
- **Framework**: Express.js
- **Language**: TypeScript
- **Database ORM**: Prisma
- **Database**: PostgreSQL (Production) / SQLite (Local Development)
- **Authentication**: JWT, Google OAuth, Passport.js

### AI & Codebase Tooling
- **AI Providers**: Unified interface supporting multiple LLMs with fallback mechanisms.
- **Codebase Knowledge**: Integrated with **Graphify** for AST-based codebase navigation and AI agent integration.

## 📁 Project Structure

```text
ManaSarathi/
|-- frontend/                  # React + Vite web application
|   |-- src/
|   |   |-- admin/             # Admin portal components
|   |   |-- components/        # Reusable & feature-specific components
|   |   |-- contexts/          # React Context providers
|   |   |-- hooks/             # Custom React hooks
|   |   |-- services/          # API integration layer
|   |   `-- stores/            # Zustand global state
|-- backend/                   # Express API
|   |-- src/
|   |   |-- controllers/       # Route handlers
|   |   |-- routes/            # Express routers
|   |   |-- services/          # Business logic & AI orchestration
|   |   `-- types/             # Shared TS interfaces
|   |-- prisma/
|   |   |-- schema.prisma      # DB schema definition
|   |   `-- dev.db             # Local SQLite database
|-- mobile/                    # React Native / Expo mobile app
|-- graphify-out/              # Graphify codebase AST graphs
`-- package.json               # Workspace configuration
```

## ⚡ Quick Start

### Prerequisites
- Node.js 18+
- npm 8+
- Python 3.10+ (for Graphify tooling)
- Optional: AI provider API keys for full chatbot functionality

### Install and Run

```powershell
# 1) Install dependencies, create env files, and seed local data
npm run setup:local

# 2) Check environment configuration
npm run doctor:config

# 3) Start backend + frontend
npm run dev
```

### Local URLs
- **Frontend**: `http://localhost:3000`
- **Backend API**: `http://localhost:5000/api`
- **Health Check**: `http://localhost:5000/api/health`
- **Prisma Studio**: `npm run db:studio`

## ⚙️ Environment Variables

### Backend (`backend/.env`)

```env
NODE_ENV=development
PORT=5000
BACKEND_URL=http://localhost:5000
FRONTEND_URL=http://localhost:3000
DATABASE_URL=file:./prisma/dev.db
JWT_SECRET=replace_with_secure_random_value
SESSION_SECRET=replace_with_secure_random_value
JWT_EXPIRE=7d

# OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# AI Configurations
AI_PROVIDER_PRIORITY=gemini,huggingface,openai,anthropic,ollama
AI_ENABLE_FALLBACK=true
GEMINI_API_KEY_1=your_key
OPENAI_API_KEY_1=your_key
ANTHROPIC_API_KEY_1=your_key
HUGGINGFACE_API_KEY=your_key
OLLAMA_ENABLED=false
```

### Frontend (`frontend/.env.local`)

```env
VITE_API_URL=http://localhost:5000/api
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

## 📜 API Overview

Base URL: `/api`

### Core Endpoints
- **Auth**: `/auth/register`, `/auth/login`, `/auth/google`, `/auth/me`
- **Chat & Memory**: `/chat/message`, `/chat/history`, `/conversations`, `/chat/insights`
- **Assessments**: `/assessments`, `/assessments/history`, `/assessments/sessions`
- **Progress & Tracking**: `/mood`, `/progress`, `/practices`, `/content`

## 🚀 Deployment Notes

- Use PostgreSQL in production (`DATABASE_URL=postgresql://...`).
- Execute `npx prisma migrate deploy` during deployment.
- Set strong production secrets for `JWT_SECRET` and `SESSION_SECRET`.
- Configure strict CORS origins and force HTTPS.

## 🧠 Developer Tooling: Graphify
This repository uses Graphify for codebase AST mapping, allowing AI agents to fully understand the architecture.
To update the graph after major changes, run:
```bash
python -m graphify update .
```

## 📄 License
MIT
