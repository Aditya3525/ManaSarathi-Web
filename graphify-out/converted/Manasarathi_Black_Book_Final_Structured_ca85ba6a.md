<!-- converted from Manasarathi_Black_Book_Final_Structured.docx -->

A PROJECT REPORT ON
MANASARATHI
AI-POWERED MENTAL WELLNESS PLATFORM WITH
HOLISTIC HEALING AND EMOTIONAL SUPPORT
SUBMITTED TO THE SAVITRIBAI PHULE PUNE UNIVERSITY, PUNE
IN THE PARTIAL FULFILLMENT OF THE REQUIREMENTS FOR THE AWARD OF THE DEGREE
OF
BACHELOR OF ENGINEERING
IN
INFORMATION TECHNOLOGY
SUBMITTED BY
UNDER THE GUIDANCE OF
PROF. R. R. YADAV
DEPARTMENT OF INFORMATION TECHNOLOGY
STES'S SINHGAD ACADEMY OF ENGINEERING
KONDHWA BK, PUNE 411048
ACADEMIC YEAR 2025-26

CERTIFICATE
This is to certify that the project report entitled
MANASARATHI: AI-POWERED MENTAL WELLNESS PLATFORM WITH HOLISTIC HEALING AND EMOTIONAL SUPPORT
Submitted by Mr. Aditya Shirsat, Mr. Atharva Lole, Ms. Neha Kamble, and Mr. Sourabh Shirkande is a bonafide work carried out under the supervision of Prof. R. R. Yadav. It is approved for the partial fulfilment of the requirement of Savitribai Phule Pune University for the award of the degree of Bachelor of Engineering in Information Technology during the academic year 2025-26.
Place: Pune

DECLARATION
We hereby declare that this project report is an original record of the work carried out by us under the guidance of Prof. R. R. Yadav. The material presented in this report has not been submitted elsewhere for the award of any degree or diploma. External ideas, research findings, frameworks, libraries, and technical documentation used during development have been appropriately acknowledged.

ACKNOWLEDGEMENT
We would like to thank our guide, Prof. R. R. Yadav, for his continuous guidance, encouragement, and valuable suggestions throughout the development of Manasarathi. We are also thankful to the Head of Department, project coordinator, teaching and non-teaching staff, friends, and family members for their support during the completion of this final year project.

ABSTRACT
Manasarathi is a full-stack, AI-assisted mental wellness platform designed to improve access to structured self-care, emotional reflection, and professional oversight. The system combines user onboarding, standardized mental-health assessments, mood and sleep tracking, journaling, gratitude and habit features, personalized wellness plans, multimedia practices, progress analytics, a crisis-aware AI companion, an administrator portal, and a therapist portal. The web application is implemented using React, Vite, TypeScript, Tailwind CSS, Radix UI, Zustand, TanStack React Query, and i18next. The backend uses Express.js and TypeScript with Prisma ORM, SQLite for local development, and PostgreSQL for production. A unified AI provider service supports Gemini, OpenAI, Anthropic, Hugging Face, NVIDIA, and Ollama with fallback handling. Safety is treated as a core requirement through crisis detection, emergency resources, privacy controls, support workflows, and non-clinical boundaries.
Keywords: Artificial Intelligence, Mental Wellness, Conversational AI, Crisis Detection, Cognitive Behavioural Therapy, Clinical Assessment, React, Express, Prisma, Privacy.

TABLE OF CONTENTS

LIST OF FIGURES
Figure 1. System Architecture Diagram
Figure 2. Component Architecture Diagram
Figure 3. Data Flow Diagram
Figure 4. Overall Use-Case Diagram
Figure 5. User Module Use-Case Diagram
Figure 6. Admin Module Use-Case Diagram
Figure 7. Therapist Module Use-Case Diagram
Figure 8. Entity-Relationship Diagram
Figure 9. Class Diagram
Figure 10. Assessment Sequence Diagram
Figure 11. Chat and AI Sequence Diagram
Figure 12. End-to-End Activity Diagram
Figure 13. Crisis Detection Activity Diagram
Figure 14. Chat/User State Machine
Figure 15. Application Dashboard Result

LIST OF TABLES
Table 1. Literature Survey Summary
Table 2. Functional Requirements
Table 3. Non-Functional Requirements
Table 4. Hardware and Software Requirements
Table 5. Project Plan and Milestones
Table 6. Risk Management Summary
Table 7. Technology Stack
Table 8. Core API Groups
Table 9. Result Summary
Table 10. Testing Strategy
Table 11. Representative Test Cases

ABBREVIATIONS

CHAPTER 1
INTRODUCTION
# Chapter 1 INTRODUCTION
## 1.1 Introduction
Mental wellbeing is affected by academic pressure, career uncertainty, social isolation, sleep quality, personal relationships, and access to timely guidance. Many users hesitate to seek professional help because of stigma, cost, limited awareness, or uncertainty about the correct first step. Digital wellness platforms can provide a private and structured starting point, but they must be designed with safety, transparency, and clear non-clinical boundaries.
Manasarathi addresses this need by combining self-reflection, assessment, AI-assisted conversation, personalized resources, safety support, and professional oversight into one unified platform.
## 1.2 Objectives of Project Report
- Provide secure user registration, authentication, onboarding, and profile management.
- Offer standardized mental wellness assessments and historical result tracking.
- Support mood, sleep, journal, gratitude, intention, habit, and check-in workflows.
- Implement a context-aware AI companion with provider fallback and conversation continuity.
- Detect crisis indicators and surface grounding exercises, safety resources, and emergency guidance.
- Provide admin and therapist portals for governance, support, bookings, and session notes.
- Maintain deployable frontend and backend architecture for local and production environments.
## 1.3 Organization of Project Report
Chapter 2 reviews related work. Chapter 3 defines the software requirements. Chapter 4 presents system design using architecture, DFD, UML, and database diagrams. Chapter 5 describes the project plan. Chapter 6 explains implementation and result set. Chapter 7 covers testing. Chapter 8 concludes the work and future scope. Chapter 9 lists references.

CHAPTER 2
LITERATURE SURVEY
# Chapter 2 LITERATURE SURVEY
## 2.1 Literature Survey
Research on AI-powered mental-health chatbots shows that conversational support can improve accessibility and engagement when it uses structured psychological principles and clearly communicates limitations. Reviews of large language models in mental-health contexts identify opportunities in personalization, screening, psychoeducation, emotional regulation, and early awareness, while also warning about hallucination, privacy risk, cultural limitations, and crisis-response concerns.
Table 1. Literature Survey Summary
## 2.2 Gap Analysis
- Existing apps often separate chat, assessments, tracking, and content into unrelated products.
- Single-provider AI systems are vulnerable to outages, quota failures, and model limitations.
- Safety is often implemented through simple keyword matching without longitudinal context.
- Therapist and administrator oversight is absent in many self-care applications.
- Users often lack clear control over consent, export, deletion, and clinician sharing.

CHAPTER 3
SOFTWARE REQUIREMENTS SPECIFICATIONS
# Chapter 3 SOFTWARE REQUIREMENTS SPECIFICATIONS
## 3.1 Introduction
The Software Requirements Specification defines the expected behavior, constraints, user roles, and operating environment of Manasarathi. The primary user classes are end users, administrators, therapists, and system maintainers.
## 3.2 Functional Requirements
Table 2. Functional Requirements
## 3.3 Non-Functional Requirements
Table 3. Non-Functional Requirements
## 3.4 System Requirements
Table 4. Hardware and Software Requirements
## 3.5 Assumptions and Dependencies
The system assumes reliable internet access for hosted use, valid AI provider keys for full chatbot behavior, and secure deployment secrets for production. Local development can use SQLite and fallback configurations.

CHAPTER 4
SYSTEM DESIGN
# Chapter 4 SYSTEM DESIGN
## 4.1 Data Flow Diagram (DFD)

Figure 1. System Architecture Diagram

Figure 2. Component Architecture Diagram

Figure 3. Data Flow Diagram
## 4.2 UML Diagrams

Figure 4. Overall Use-Case Diagram

Figure 5. User Module Use-Case Diagram

Figure 6. Admin Module Use-Case Diagram

Figure 7. Therapist Module Use-Case Diagram

Figure 8. Entity-Relationship Diagram

Figure 9. Class Diagram

Figure 10. Assessment Sequence Diagram

Figure 11. Chat and AI Sequence Diagram

Figure 12. End-to-End Activity Diagram

Figure 13. Crisis Detection Activity Diagram

CHAPTER 5
PROJECT PLAN
# Chapter 5 PROJECT PLAN
## 5.1 Project Estimates
Table 5. Project Plan and Milestones
## 5.2 Risk Management
Table 6. Risk Management Summary

Figure 14. Chat/User State Machine

CHAPTER 6
IMPLEMENTATION
# Chapter 6 IMPLEMENTATION
## 6.1 System Architecture
Manasarathi follows a layered architecture consisting of presentation, API, service, AI provider, and persistence layers. The frontend is organized into feature components, hooks, stores, contexts, and services. The backend is organized into routes, controllers, services, middleware, configuration, Prisma schema, and provider adapters.
## 6.2 Tools and Technologies Used
Table 7. Technology Stack
## 6.3 Coding and Modules
The frontend root application controls page navigation for landing, login, onboarding, dashboard, assessments, chatbot, content library, practices, journal, games, profile, admin, and therapist portal. API calls are centralized through service modules and data-fetching hooks. The backend registers route groups for authentication, users, assessments, plans, chat, chatbot, conversations, dashboard, mood, journal, content, admin, support, crisis, therapists, therapist portal, and privacy operations.
Table 8. Core API Groups
## 6.4 Result Set
The completed system provides a working full-stack web application with protected authentication, onboarding, dashboard insights, assessments, AI companion, content/practices, journal, games, profile, help and safety, admin dashboard, and therapist portal. The following result summary maps implemented areas to observable outcomes.
Table 9. Result Summary

Figure 15. Application Dashboard Result

CHAPTER 7
TESTING
# Chapter 7 TESTING
## 7.1 Testing Approach
Testing was performed as a combination of static verification, automated backend/API tests, frontend checks, and manual user-flow validation. The backend uses Vitest and Supertest-oriented tests for authentication, assessments, chat APIs, dashboard insights, health readiness, privacy, recommendations, support, mood, therapist portal, and LLM fallback behavior. TypeScript type checking and build scripts verify code consistency across workspaces.
Table 10. Testing Strategy
## 7.2 Test Cases
Table 11. Representative Test Cases
## 7.3 Validation Considerations
Because the domain involves mental wellbeing, validation must extend beyond technical correctness. Future validation should include usability studies with students, accessibility audits, clinician review of assessment explanations and crisis messages, privacy impact assessment, bias evaluation, and controlled longitudinal evaluation. Crisis-detection sensitivity and specificity must be evaluated carefully to reduce missed risk as well as unnecessary escalation.

CHAPTER 8
CONCLUSION
# Chapter 8 CONCLUSION
## 8.1 Conclusion
Manasarathi demonstrates that AI-assisted mental wellness support can be organized as a modular, full-stack platform rather than a collection of isolated tools. The implemented application combines authentication, onboarding, assessments, tracking, AI conversation, recommendations, help and safety, admin governance, and therapist workflows around a shared user model. The system does not replace licensed medical care, but it provides structured self-reflection, awareness, resources, and professional connection points.
## 8.2 Future Scope
- Clinical review of assessment interpretations and crisis messages.
- Expanded multilingual support and culturally localized content.
- Native mobile application and offline-first tracking.
- Improved analytics for long-term wellness patterns.
- Secure production media storage and stronger audit retention.
- More extensive automated frontend tests and end-to-end test coverage.
- Provider-cost monitoring and explainability around AI recommendations.

CHAPTER 9
REFERENCES
# Chapter 9 REFERENCES
[1] A. Thakkar, A. Gupta, and A. De Sousa, Artificial Intelligence in Positive Mental Health: A Narrative Review, Frontiers in Digital Health, 2024.
[2] Z. B. V. Salcedo et al., Artificial Intelligence and Mental Health Issues: A Narrative Review, Journal of Public Health Sciences, 2023.
[3] K. K. Fitzpatrick, A. Darcy, and M. Vierhile, Delivering Cognitive Behavior Therapy to Young Adults Using a Fully Automated Conversational Agent, JMIR Mental Health, 2017.
[4] L. Laranjo et al., The effects of conversational agents on health outcomes: systematic review, Journal of Medical Internet Research.
[5] World Health Organization, Mental health: strengthening our response, https://www.who.int/.
[6] OWASP Foundation, OWASP Top Ten Web Application Security Risks, https://owasp.org/.
[7] React Documentation, https://react.dev/.
[8] Express.js Documentation, https://expressjs.com/.
[9] Prisma ORM Documentation, https://www.prisma.io/docs/.
[10] Vite Documentation, https://vite.dev/.

CHAPTER A
APPENDIX
# Chapter A APPENDIX
## Appendix A.1 Project Directory Structure
The repository contains separate frontend and backend workspaces. The frontend includes admin, therapist, feature components, contexts, hooks, services, stores, UI primitives, and routing. The backend includes routes, controllers, services, middleware, config, Prisma schema, tests, scripts, uploads, and seed files.
## Appendix A.2 Important Operating Commands
| Student Name | Examination Number |
| --- | --- |
| Mr. Aditya Shirsat | B400430407 |
| Mr. Atharva Lole | B400430382 |
| Ms. Neha Kamble | B400430371 |
| Mr. Sourabh Shirkande | B400430406 |
| Prof. R. R. Yadav
Guide
Department of Information Technology | Dr. S. S. Kulkarni
H.O.D.
Department of Information Technology | Principal
SAOE, Pune |
| --- | --- | --- |
| External Examiner
Signature: ________________ | Project Coordinator
Signature: ________________ | Date: ____ / ____ / 2026 |
| Project Group Member | Signature |
| --- | --- |
| Mr. Aditya Shirsat | ________________ |
| Mr. Atharva Lole | ________________ |
| Ms. Neha Kamble | ________________ |
| Mr. Sourabh Shirkande | ________________ |
| Chapter | Title |
| --- | --- |
| Chapter 1 | Introduction |
| Chapter 2 | Literature Survey |
| Chapter 3 | Software Requirements Specifications |
| Chapter 4 | System Design |
| Chapter 5 | Project Plan |
| Chapter 6 | Implementation and Result Set |
| Chapter 7 | Testing |
| Chapter 8 | Conclusion and Future Scope |
| Chapter 9 | References |
| Appendix A | Project Directory and Commands |
| Abbreviation | Meaning |
| --- | --- |
| AI | Artificial Intelligence |
| API | Application Programming Interface |
| CBT | Cognitive Behavioural Therapy |
| CSRF | Cross-Site Request Forgery |
| DFD | Data Flow Diagram |
| JWT | JSON Web Token |
| LLM | Large Language Model |
| ORM | Object-Relational Mapping |
| SRS | Software Requirements Specification |
| UML | Unified Modelling Language |
| Study / Source | Contribution | Identified Gap |
| --- | --- | --- |
| Fitzpatrick et al. - Woebot | Demonstrated feasibility of automated CBT-style conversation. | Limited integration with broader tracking and professional workflows. |
| LLM mental health reviews | Discussed capabilities of generative AI for support and guidance. | Need for safety, guardrails, and human oversight. |
| WHO mental health resources | Highlights importance of access, awareness, and timely support. | Digital systems need local resources and responsible boundaries. |
| OWASP guidance | Defines security risk areas for web systems. | Mental wellness systems require strong privacy-by-design implementation. |
| ID | Module | Requirement |
| --- | --- | --- |
| FR-01 | Authentication | Register, login, Google OAuth, password setup, and protected sessions. |
| FR-02 | Onboarding | Collect profile, wellbeing approach, consent, and emergency contact details. |
| FR-03 | Assessments | Start, submit, score, and store individual and combined assessments. |
| FR-04 | Dashboard | Show wellness score, trends, reminders, recommendations, and recent activity. |
| FR-05 | AI Companion | Support contextual chat, memory, feedback, fallback, and crisis-aware responses. |
| FR-06 | Tracking | Persist mood, sleep, journal, gratitude, habit, intention, and check-in records. |
| FR-07 | Content | Provide practices, articles, videos, meditations, and personalized recommendations. |
| FR-08 | Admin | Manage users, content, assessments, analytics, support, crisis resources, and media. |
| FR-09 | Therapist | Manage bookings, client context, and session notes. |
| FR-10 | Privacy | Support consent settings, data export, and account deletion. |
| Category | Requirement |
| --- | --- |
| Security | JWT/OAuth authentication, password hashing, CSRF protection, input sanitization, and rate limiting. |
| Privacy | Consent tracking, export, deletion, and minimized exposure of sensitive records. |
| Reliability | Provider fallback, readiness checks, graceful shutdown, and logged errors. |
| Performance | Responsive frontend, cached queries, and modular backend services. |
| Usability | Clear navigation, responsive layouts, accessibility-conscious controls, and multilingual support. |
| Maintainability | TypeScript, modular routes/controllers/services, Prisma schema, and tests. |
| Component | Specification |
| --- | --- |
| Developer System | Node.js 18+, npm 8+, modern browser, 8 GB RAM recommended. |
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, Radix UI. |
| Backend | Express.js, TypeScript, Prisma ORM, PostgreSQL/SQLite. |
| AI Providers | Gemini, OpenAI, Anthropic, Hugging Face, NVIDIA, Ollama as configured. |
| Deployment | Frontend static hosting, backend Node hosting, managed PostgreSQL. |
| Phase | Activities | Deliverables |
| --- | --- | --- |
| Problem Definition | Domain study, user roles, scope, safety boundaries. | Problem statement and objectives. |
| Design | Architecture, UML, database design, API planning. | Design diagrams and schema. |
| Implementation | Frontend, backend, AI providers, admin/therapist modules. | Working application modules. |
| Testing | Unit, API, integration, manual flow validation. | Test cases and result summary. |
| Documentation | Black book, user manual, diagrams, deployment notes. | Final report and supporting documents. |
| Risk | Impact | Mitigation |
| --- | --- | --- |
| AI provider failure | Chat interruption. | Multiple providers, fallback, cooldown, and readiness checks. |
| Sensitive data exposure | Privacy and trust impact. | JWT, CSRF, hashing, consent, export, and deletion controls. |
| Incorrect crisis response | User safety risk. | Severity patterns, safety resources, and non-clinical boundaries. |
| Scope growth | Schedule delay. | Modular development and prioritized core features. |
| Deployment misconfiguration | Runtime failure. | Environment validation and health endpoints. |
| Area | Technology | Purpose |
| --- | --- | --- |
| Frontend | React 18, Vite, TypeScript | Responsive web application and modular UI. |
| UI | Tailwind CSS, Radix UI, Lucide icons | Reusable accessible interface primitives. |
| State/Data | Zustand, TanStack React Query | Global state and API caching. |
| Backend | Express.js, TypeScript | REST API and business logic. |
| Database | Prisma, SQLite, PostgreSQL | ORM, local database, production database. |
| AI | Gemini, OpenAI, Anthropic, Hugging Face, NVIDIA, Ollama | Multi-provider AI support and fallback. |
| Testing | Vitest, Supertest, TypeScript checks | Automated verification and regression testing. |
| API Group | Purpose |
| --- | --- |
| /api/auth | Registration, login, OAuth, current user, password setup. |
| /api/assessments | Templates, sessions, scoring, history, insights. |
| /api/chat and /api/chatbot | AI conversation, memory, feedback, crisis checks. |
| /api/dashboard | Aggregated user summary, insights, recommendations. |
| /api/content and /api/practices | Content library, practices, bookmarks, engagement. |
| /api/admin | Platform management and analytics. |
| /api/therapist-portal | Therapist login, bookings, notes, client context. |
| /api/privacy | Consent, export, deletion, and privacy settings. |
| Area | Observed Result |
| --- | --- |
| Architecture | Frontend and backend are separated into npm workspaces with clear module boundaries. |
| Authentication | Email/password, JWT, Google OAuth, onboarding, and protected routes are implemented. |
| Assessments | Individual and combined assessment sessions, scoring, history, and insights are supported. |
| AI Companion | Context, memory, provider fallback, crisis checks, conversation history, and feedback are integrated. |
| Tracking | Mood, sleep, journal, gratitude, intentions, habits, and check-ins are persisted. |
| Admin/Therapist | Administrative management and therapist booking/note workflows are available. |
| Safety | Crisis resources, safety planning, support tickets, and ethical boundaries are represented. |
| Deployment | Local setup scripts, Render/Vercel configuration, and health endpoints are available. |
| Test Level | Tools / Method | Focus |
| --- | --- | --- |
| Static Verification | TypeScript compiler, ESLint | Types, imports, contracts, unsafe patterns. |
| Unit Testing | Vitest | Services, utilities, assessment logic, fallback behavior. |
| API Testing | Vitest, Supertest | Routes, validation, auth, database behavior. |
| Integration Testing | Scripted/manual flows | Login, onboarding, assessments, dashboard, chat, admin, therapist. |
| Manual UI Testing | Browser walkthrough | Navigation, responsiveness, forms, screenshots, result set. |
| ID | Scenario | Expected Result |
| --- | --- | --- |
| TC-01 | Register with valid user details. | Account created and onboarding flow begins. |
| TC-02 | Login with valid credentials. | JWT is stored and protected dashboard opens. |
| TC-03 | Submit assessment responses. | Score, history, and insights are saved. |
| TC-04 | Open dashboard after assessment. | Wellness summary and recommendations update. |
| TC-05 | Send chatbot message. | AI response is generated and conversation is stored. |
| TC-06 | Trigger crisis-like input. | Safety resources and grounding guidance are surfaced. |
| TC-07 | Admin manages content or assessment. | CRUD action is applied and activity is tracked. |
| TC-08 | Therapist processes booking. | Booking status and notes are updated. |
| TC-09 | Request privacy export/deletion. | Appropriate privacy workflow is executed. |
| TC-10 | Call health readiness endpoint. | Database and AI provider status is returned. |
| Command | Purpose |
| --- | --- |
| npm run setup:local | Install dependencies, create local env files, generate/sync database, and seed data. |
| npm run doctor:config | Validate environment configuration. |
| npm run dev | Start backend and frontend development servers. |
| npm run build | Build frontend and backend for production. |
| npm run typecheck | Run TypeScript checks in both workspaces. |
| npm run test | Run backend and frontend test suites. |
| npm run db:studio | Open Prisma Studio for database inspection. |