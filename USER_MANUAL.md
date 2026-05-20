# MaanSarathi — User Manual

This manual explains how to use the MaanSarathi platform from three perspectives: **User**, **Therapist**, and **Administrator**. It covers account setup, primary workflows, safety & privacy, and troubleshooting.

Table of contents
- Introduction
- Quick access (web & mobile)
- User guide (end-user)
- Therapist guide
- Admin guide
- Safety, privacy & data export
- Troubleshooting & FAQ

---

## Introduction

MaanSarathi helps users track mood, complete clinical assessments, access therapeutic content, chat with an AI companion, and (optionally) connect with therapists. Therapists can manage clients, review assessments and notes. Admins operate the platform: manage users, content, and safety resources.

## Quick access

- Web (recommended for full admin/therapist workflows): `http://localhost:3000`
- Backend API: `http://localhost:5000/api` (used by clients)
- Mobile (recommended for end-users): Expo app or published store builds

Credentials & sign-in options
- Email/password registration via `Sign up`.
- Google OAuth (if enabled) via `Sign in with Google`.
- Password recovery available on the login page.

---

## User guide (End-user)

1) Getting started
- Register an account or sign in with Google.
- Complete onboarding (optional): brief demographic and preferences, notification opt-ins, and privacy settings.

2) Home / Dashboard
- View today's mood summary, quick actions (check-in, log sleep, open journal), and recommended practices.
- Tap any recommendation to open the practice or content detail.

3) Daily check-ins & mood logging
- Open `Check-in` or `Mood` from the bottom nav.
- Record mood (intensity, context tags) and optional free-text reflection.
- Review weekly trend charts in `Progress`.

4) Assessments
- Go to `Assessments` and select an available questionnaire (PHQ-9, GAD-7, etc.).
- Complete answers; submit to get an immediate score and AI summary.
- Optionally share results with a therapist (toggle share on assessment detail).

5) Chat / AI Companion
- Open `Chat` to have a contextual conversation. The assistant can suggest grounding exercises, summarize feelings, and suggest resources.
- Conversation history is stored securely and can be exported from `Profile → Data & Privacy`.

6) Content, Practices & Games
- Browse `Content` for articles, audio, and videos. Tap `Start` to begin guided practices.
- Mini-games are under `Games` (mobile). Scores and achievements are saved to your profile.

7) Bookmarks, Plans & Notifications
- Save content with the bookmark icon. View saved content under `Bookmarks`.
- Wellness plans and recommended activities appear under `Plans`.
- Manage push/email notifications under `Profile → Notifications`.

8) Profile, Privacy & Data Export
- Edit profile and preferences in `Profile`.
- Export your personal data (JSON) from `Profile → Data & Privacy`.
- Request account deletion from the same page; deletion follows the configured retention policy and may require confirmation.

---

## Therapist guide

1) Accessing the Therapist Portal
- Sign in with your therapist account. If not provisioned, contact an admin to create a therapist account.

2) Dashboard
- View active clients, crisis alerts, upcoming appointments, and recent assessment aggregates.

3) Client Management
- Search clients by name or ID. Open a client profile to view personal details, shared assessments, progress trends, and notes.
- Add session notes and flag safety concerns. Notes are saved to the client record and time-stamped.

4) Assessments & Review
- View submitted assessments and scoring breakdowns.
- Add clinician interpretation and recommendations; optionally send a follow-up plan to the client.

5) Scheduling & Bookings
- Use the integrated calendar to create, edit, or cancel appointments. Clients receive booking notifications.

6) Crisis Workflow
- Crisis alerts surface under `Safety Alerts`. Open an alert, review the assessment and check-in history, and follow the facility-specific escalation protocol.
- Use the `Safety Plan` template to collaborate with the client and export a copy.

7) Data & Exports
- Export client data for case reviews or supervision (respect consent). Use `Export` within a client profile.

---

## Admin guide

1) Admin access
- Admins have a special role; sign in with an admin account. Initial admin credentials are seeded via `ADMIN_INITIAL_PASSWORD` if set during deployment.

2) User management
- Use `Admin → Users` to list, search, suspend, or delete accounts. View activity logs for user actions.

3) Content & Assessment Builder
- Manage the content library (articles, media, practices). Use the Assessment Builder to create or update questionnaires, set scoring rules, and publish/unpublish assessments.

4) Safety & Crisis Resources
- Edit curated crisis resources and safety plans under `Help & Safety → Resources`.

5) System & Settings
- Review system logs, API health, and usage metrics in `Admin → Diagnostics`.
- Configure AI provider priorities and feature flags; changes may require a backend restart.

6) Deployments & Backups
- Use the deployment guide in `README.md → Deployment` for Render/Vercel/EAS steps.
- Schedule DB backups and verify Prisma migrations via the `backend` tools.

---

## Safety, Privacy & Data Export

- Personal data and chat history are stored per the configured retention policy. Admins can configure export retention and deletion windows.
- Users can export their own data in JSON from `Profile → Data & Privacy` and request deletion.
- Therapists must obtain client consent before exporting client records for external use.

---

## Troubleshooting & FAQ

- I can't login: verify your email and password or use `Forgot password`. If OAuth fails, check `FRONTEND_URL` and provider settings.
- Chat is not responding: check backend connectivity and AI provider keys; see `backend/.env` for configured providers.
- Missing content or translations: run `npm run setup:local` then `npm run seed:demo` to reseed demo content for local development.

If you still need help, open a support ticket from the app (`Help → Support`) or contact the platform admin.

---

## Contact & Contribution

- For platform issues, open an issue in the repo or use the built-in support ticketing system.
- Developers: follow the developer instructions in `README.md` at the repo root for setup and tests.

---

End of user manual. For screenshots and step-by-step annotated walkthroughs, request a guided doc and I will add them to this manual.
