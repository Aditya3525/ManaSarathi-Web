# MaanSarathi

An AI-powered comprehensive mental wellbeing platform providing personalized support, mood tracking, clinical assessments, therapeutic games, and professional oversight — available on **Web** and **Mobile**.

This repository is a monorepo containing three packages: the **React web frontend**, the **Express/Prisma backend API**, and the **React Native / Expo mobile app**.

---

## 🚀 Project Overview

MaanSarathi bridges the gap between self-care and professional mental health support. By leveraging AI, the platform provides real-time empathetic conversations, emotional progress tracking, and personalized mindfulness and CBT (Cognitive Behavioral Therapy) resources — all accessible from a browser or a native mobile device.

### Core Architecture & Modules

#### 1. AI & Conversational Engine
- **Multi-Provider LLM Chatbot**: Context-aware agent with automatic fallback across Gemini, OpenAI, Anthropic, Hugging Face, NVIDIA, and Ollama.
- **Conversation Memory**: Tracks long-term emotional patterns, important moments, action items, and therapeutic goals across sessions.
- **Session Continuity**: Resumes conversations intelligently across devices and sessions.
- **Crisis Detection**: Real-time sentiment and keyword analysis with escalation paths and emergency grounding exercises.

#### 2. Clinical Assessments
- **Configurable Assessment Engine**: Standardized mental health assessments (PHQ-9, GAD-7, etc.) with a drag-and-drop admin builder.
- **AI-Powered Insights**: Wellness scores, trend analysis, and long-term shift detection in well-being.

#### 3. Daily Tracking & Reflection
- **Mood & Check-ins**: Granular mood logging with triggers, intensity levels, and daily check-in summaries.
- **Sleep Tracking**: Sleep hygiene logs and quality analysis.
- **Journaling**: Reflective journal entries with AI pattern summaries.
- **Habits, Intentions & Gratitude**: Daily intention setting, gratitude logs, and habit streaks.

#### 4. Content, Practices & Therapeutic Games
- **Multimedia Resources**: Articles, video, audio meditations, breathing exercises, and yoga sequences.
- **Personalized Recommendations**: Engine suggests practices based on mood, engagement history, and assessment results.
- **Therapeutic Mini-Games** *(Mobile)*: Interactive mental wellness games including Breathing Guide, Anxiety Pop, Memory Match, Mindful Patterns, Mood Colors, and Gratitude Puzzle.

#### 5. Admin & Therapist Portals
- **Therapist Portal**: Clinicians can view client profiles, manage session notes, handle bookings via a calendar, and monitor crisis alerts.
- **Admin Dashboard**: Full platform management including user management, content curation, assessment builder, FAQ/support tickets, crisis resources, media manager, and system diagnostics.

#### 6. Help & Safety System
- **Support Tickets**: User-initiated support requests with admin management.
- **FAQ System**: Categorized frequently asked questions.
- **Crisis Resources & Safety Plans**: Curated emergency resources with admin-managed content.

#### 7. Privacy & Data Control
- **Privacy Settings**: Granular user data control.
- **Data Export**: Users can export their personal data.
- **Account Deletion**: Self-service account and data removal.

---

## 🛠 Tech Stack

### Web Frontend (`frontend/`)
| Concern | Technology |
|---|---|
| Framework | React 18 + Vite |
| Language | TypeScript |
| Styling | Tailwind CSS + Radix UI |
| State Management | Zustand + React Context |
| Routing | Internal path-based routing (`App.tsx`) |
| Internationalization | i18next |
| Testing | Vitest |

### Mobile App (`mobile/`)
| Concern | Technology |
|---|---|
| Framework | React Native (Expo SDK 54) |
| Language | TypeScript |
| Routing | Expo Router (file-based) |
| Styling | NativeWind (Tailwind for RN) |
| State Management | Zustand |
| Data Fetching | TanStack React Query |
| Internationalization | i18next (EN, HI, DE, ES, FR, ZH) |
| Notifications | Expo Notifications |
| Offline Support | AsyncStorage + offline cache service |
| Auth | JWT + Expo Secure Store + OAuth (Google) |
| Media | expo-av (audio/video) |
| Biometrics | expo-local-authentication |
| Deep Linking | expo-linking |
| Build & Distribution | Expo Application Services (EAS) |
| Testing | Jest + jest-expo |

### Backend (`backend/`)
| Concern | Technology |
|---|---|
| Framework | Express.js |
| Language | TypeScript |
| Database ORM | Prisma |
| Database | PostgreSQL (Production) / SQLite (Local Dev) |
| Authentication | JWT + Google OAuth + Passport.js |
| Logging | Pino + pino-http |
| Testing | Vitest |
| Email | Email service (nodemailer-compatible) |
| File Uploads | Multer → `/uploads` static serving |

### AI Providers (Backend Services)
- `GeminiProvider`, `OpenAIProvider`, `AnthropicProvider`, `HuggingFaceProvider`, `NvidiaProvider`, `OllamaProvider`
- Unified `llmProvider` with automatic priority-based fallback.

---

## 📁 Project Structure

```text
MaanSarathi/
├── frontend/                        # React + Vite web application
│   └── src/
│       ├── admin/                   # Full admin portal (27 components)
│       ├── therapist/               # Therapist portal (dashboard, calendar, notes)
│       ├── components/
│       │   ├── features/            # Feature-specific components
│       │   ├── common/              # Shared UI components
│       │   ├── layout/              # Page layout components
│       │   └── ui/                  # Primitive UI components
│       ├── contexts/                # React Context providers
│       ├── hooks/                   # Custom React hooks
│       ├── services/                # API integration layer
│       ├── stores/                  # Zustand global state
│       ├── styles/                  # Global CSS
│       ├── types/                   # TypeScript interfaces
│       ├── utils/                   # Utility functions
│       ├── i18n/                    # Internationalization config
│       └── App.tsx                  # Root app + routing
├── backend/                         # Express API
│   ├── src/
│   │   ├── controllers/             # Route handlers (19 controllers)
│   │   ├── routes/                  # Express routers (28+ route files)
│   │   ├── services/                # Business logic & AI orchestration (21 services)
│   │   │   └── providers/           # Individual LLM provider adapters
│   │   ├── middleware/              # Auth, error handling, health monitoring
│   │   ├── config/                  # Database, auth, passport config
│   │   ├── utils/                   # Logger and helpers
│   │   └── types/                   # Shared TS interfaces
│   └── prisma/
│       ├── schema.prisma            # Production DB schema
│       ├── schema.local.prisma      # Local SQLite schema
│       └── dev.db                   # Local SQLite database
├── mobile/                          # React Native / Expo mobile app
│   ├── app/
│   │   ├── (auth)/                  # Auth screens (login, register, forgot-password, OAuth)
│   │   ├── (onboarding)/            # Onboarding flow
│   │   ├── (tabs)/                  # Tab navigation (Home, Chat, Mood, Content, Profile)
│   │   ├── assessments/             # Assessment screens
│   │   ├── content/                 # Content detail screens
│   │   ├── games/                   # Therapeutic mini-games (6 games)
│   │   ├── help-safety/             # Help & safety screens
│   │   ├── profile/                 # Profile management screens
│   │   ├── progress/                # Progress tracking screens
│   │   ├── notifications.tsx        # Notification center
│   │   ├── recommendations.tsx      # Personalized recommendations
│   │   └── biometric-lock.tsx       # Biometric authentication gate
│   ├── services/                    # API client, auth, offline cache, notifications, media
│   ├── stores/                      # Zustand stores (app, auth, notifications)
│   ├── hooks/                       # Custom hooks
│   ├── components/ui/               # Reusable UI components
│   ├── i18n/locales/                # Translation files (EN, HI, DE, ES, FR, ZH)
│   └── config/                      # App configuration
├── shared/                          # Shared config across packages
├── graphify-out/                    # Graphify codebase AST graph output
├── render.yaml                      # Render.com deployment (frontend + backend + DB)
├── vercel.json                      # Vercel deployment config (frontend)
└── package.json                     # Root workspace configuration
```

---

## ⚡ Quick Start

### Prerequisites
- Node.js 18+
- npm 8+
- Python 3.10+ *(optional — for Graphify codebase tooling)*
- AI provider API keys *(optional — for full chatbot functionality)*

### Web (Frontend + Backend)

```powershell
# 1) Install all workspace dependencies and set up local env files
npm run setup:local

# 2) Validate environment configuration
npm run doctor:config

# 3) Start backend + frontend concurrently
npm run dev
```

### Mobile App

```bash
cd mobile
npm install
npx expo start        # Scan QR with Expo Go
# or
npm run android       # Launch Android emulator
npm run ios           # Launch iOS simulator (macOS only)
```

### Local URLs
| Service | URL |
|---|---|
| Web Frontend | `http://localhost:3000` |
| Backend API | `http://localhost:5000/api` |
| Health Check | `http://localhost:5000/api/health` |
| Readiness Check | `http://localhost:5000/api/health/ready` |
| Prisma Studio | `npm run db:studio` |
| Expo Dev Server | `http://localhost:8081` |

---

## ⚙️ Environment Variables

---

## 📘 User Manual

A detailed user manual for end-users, therapists, and platform administrators is available at [USER_MANUAL.md](USER_MANUAL.md). It covers account setup, daily workflows, therapist tools, admin operations, safety procedures, and troubleshooting.

Please consult the manual for role-specific step-by-step guides and screenshots.


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

# Rate Limiting (production)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=500

# Admin
ADMIN_INITIAL_PASSWORD=your_admin_password
```

### Frontend (`frontend/.env.local`)

```env
VITE_API_URL=http://localhost:5000/api
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

### Mobile (`mobile/.env`)

```env
EXPO_PUBLIC_API_URL=http://localhost:5000/api
EXPO_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
```

---

## 📜 API Overview

Base URL: `/api`

### Authentication
| Endpoint | Description |
|---|---|
| `POST /auth/register` | User registration |
| `POST /auth/login` | Email/password login |
| `GET /auth/google` | Google OAuth initiation |
| `GET /auth/me` | Current user profile |

### Core Features
| Endpoint Group | Description |
|---|---|
| `/chat`, `/chatbot`, `/conversations` | AI chat, chatbot, conversation history & insights |
| `/assessments`, `/assessments/sessions` | Clinical assessments & session history |
| `/mood`, `/checkins` | Mood logging & daily check-in summaries |
| `/journal`, `/sleep`, `/habits` | Journaling, sleep logs, habit tracking |
| `/intentions`, `/gratitude` | Daily intentions & gratitude logs |
| `/plans` | Personalized wellness plans |
| `/progress` | Progress analytics |
| `/practices`, `/content`, `/public-content` | Content library & mindfulness practices |
| `/recommendations` | Personalized AI recommendations |

### Engagement & Personalization
| Endpoint Group | Description |
|---|---|
| `/content/:id/engage` | Track content engagement |
| `/content/bookmarks`, `/content/:id/bookmark` | Bookmark management |
| `/dashboard` | Dashboard data aggregation |

### Help & Safety
| Endpoint Group | Description |
|---|---|
| `/support` | Support ticket submission & management |
| `/faq` | FAQ retrieval |
| `/crisis` | Crisis resources & safety plans |
| `/therapists` | Therapist directory & bookings |
| `/therapist-portal` | Therapist self-service portal |

### Admin
| Endpoint Group | Description |
|---|---|
| `/admin` | Full admin CRUD (users, content, assessments, analytics) |
| `/admin/help-safety` | Crisis resource & FAQ admin management |
| `/admin-data` | Direct database data operations |
| `/privacy` | User privacy settings, data export, account deletion |
| `/users` | User profile management |

---

## 🚀 Deployment

### Render.com (Backend + PostgreSQL)
The `render.yaml` at the repository root configures:
- **`manasarthi-backend`** — Node.js web service (generates Prisma client, syncs schema, builds, and seeds baseline content on deploy)
- **`manasarthi-db`** — Managed PostgreSQL database

```bash
# Render backend deployment steps
cd backend
npm run db:generate              # Generate Prisma client
npm run db:push:auto             # Sync production schema
npm run build                    # Compile the backend
npm run seed:production          # Seed assessments, practices, content, FAQ, crisis resources, therapists
npm start                        # Start production server

# Vercel frontend deployment is handled separately from the repo root
npm run build --workspace frontend
```

### Vercel (Frontend)
`vercel.json` is configured at the repository root for SPA rewrites and a Vite build from `frontend/`.

### GitHub Actions
The repository keeps CI in `.github/workflows/ci.yml` for type/build/test checks. Production deployment is owned by Render and Vercel, so older Azure/Netlify/Railway/Heroku workflows have been removed to prevent accidental or confusing deploy paths.

### Mobile (EAS Build)
```bash
cd mobile
eas build --profile production --platform all   # Build iOS + Android
eas submit --platform ios                        # Submit to App Store
eas submit --platform android                    # Submit to Play Store
```

### Production Checklist
- Use PostgreSQL (`DATABASE_URL=postgresql://...`)
- Set strong `JWT_SECRET` and `SESSION_SECRET`
- Set `FRONTEND_URL` to your Vercel production URL
- Set `VITE_API_URL` in Vercel to your Render backend URL
- Configure strict CORS origins; use `ADDITIONAL_CORS_ORIGINS` for explicit staging/preview URLs
- Replace demo therapist seed profiles with verified provider data before a public launch
- Force HTTPS
- Set `NODE_ENV=production`

---

## 🧠 Developer Tooling: Graphify

This repository uses **Graphify** for AST-based codebase graph generation, enabling AI agents to navigate and understand the architecture. The graph output lives in `graphify-out/`.

```bash
# Regenerate after major structural changes
python -m graphify update .
```

---

## 🧪 Testing

```powershell
# Run all tests (frontend + backend)
npm run test

# Run individually
npm run test:backend
npm run test:frontend

# Mobile
cd mobile && npm test
```

---

## 🔧 Useful Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start backend + frontend concurrently |
| `npm run setup:local` | Install deps, create env files, seed local DB |
| `npm run doctor:config` | Validate environment configuration |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run lint` | Lint frontend + backend |
| `npm run typecheck` | TypeScript type-check both packages |
| `npm run build` | Production build (frontend + backend) |
| `npm run clean` | Remove all build artifacts and node_modules |

---

## 📄 License
MIT
