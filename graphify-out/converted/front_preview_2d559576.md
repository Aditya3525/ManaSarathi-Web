<!-- converted from front_preview.docx -->

A PROJECT REPORT ON
MAAN SARATHI
AI-POWERED MENTAL WELLNESS PLATFORM WITH
HOLISTIC HEALING AND EMOTIONAL SUPPORT

SUBMITTED TO THE SAVITRIBAI PHULE PUNE UNIVERSITY, PUNE
IN THE PARTIAL FULFILLMENT OF THE REQUIREMENTS FOR THE AWARD OF THE
DEGREE
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
MAANSARATHI: AI-POWERED MENTAL WELLNESS PLATFORM WITH HOLISTIC HEALING AND EMOTIONAL SUPPORT
Submitted by
is a bonafide work has been carried out by them under the supervision of PROF. R. R. YADAV and it is approved for the partial fulfilment of the requirement of Savitribai Phule Pune University, for the award of the degree of Bachelor of Engineering (INFORMATION TECHNOLOGY).

DECLARATION
We hereby declare that this project report is an original record of the work carried out by us under the guidance of Prof. M. S. Kale. The material presented in this report has not been submitted elsewhere for the award of any degree or diploma. External ideas, research findings, frameworks, libraries, and technical documentation used during development have been appropriately acknowledged.

ACKNOWLEDGEMENT
would like to thank my Guide, Prof. R.R.Yadav whose supervision and valuable discussion has helped us tremendously to complete our project on” Manasarthi AI Powered Mental wellness platform with holistic healing and emotional support.”. His guidance proved to be valuable to overcome all the hurdles in the fulfilment of this project.
I express my sincere appreciation towards the efforts taken by our project co-ordinator Dr.
S. L. Bangare whose sincere guidance and leadership have helped us achieve the milestones set periodically.
I am grateful to Dr. S. S. Kulkarni, Head of Information Technology Department for providing all the necessary facilities and help. I also thank all the teaching and non-teaching staff of Information Technology Department, for their direct and indirect help in the completion of the project.
Project Group Members:

ABSTRACT
MaanSarathi is a full-stack, AI-assisted mental wellness platform designed to improve access to structured self-care, emotional reflection, and professional oversight. The system combines user onboarding, standardized mental-health assessments, mood and sleep tracking, journaling, gratitude and habit features, personalized wellness plans, multimedia practices, progress analytics, a crisis-aware AI companion, an administrator portal, and a therapist portal.
The web application is implemented using React 18, Vite, TypeScript, Tailwind CSS, Radix UI, Zustand, TanStack React Query, and i18next. The backend uses Express.js and TypeScript with Prisma ORM, SQLite for local development, and PostgreSQL for production. Authentication is provided through JWT and Google OAuth. A unified AI provider service supports Gemini, OpenAI, Anthropic, Hugging Face, NVIDIA, and Ollama with priority-based fallback and cooldown handling.
Safety is treated as a core requirement. Crisis detection combines keyword patterns, AI-assisted risk classification, assessment history, mood trajectory, and engagement context. The platform provides safety plans, emergency resources, support-ticket workflows, data export, privacy controls, and account deletion. The completed implementation demonstrates that a modular architecture can combine personalization, data-driven wellbeing insights, and role-based oversight while retaining clear non-clinical boundaries.
Keywords: Artificial Intelligence, Mental Wellness, Conversational AI, Crisis Detection, Cognitive Behavioural Therapy, Clinical Assessment, React, Express, Prisma, Data Privacy.

| MR. ADITYA SHIRSAT | EXAM NO: B400430407 |
| --- | --- |
| MR. ATHARVA LOLE | EXAM NO: B400430382 |
| MS. NEHA KAMBLE | EXAM NO: B400430371 |
| MR. SOURABH SHIRKANDE | EXAM NO: B400430406 |
| MR. ADITYA SHIRSAT | EXAM NO: B400430407 |
| --- | --- |
| MR. ATHARVA LOLE | EXAM NO: B400430382 |
| MS. NEHA KAMBLE | EXAM NO: B400430371 |
| MR. SOURABH SHIRKANDE | EXAM NO: B400430406 |
| PROF. R. R. YADAV
Guide
Department of
Information Technology | Dr. S. S. Kulkarni
H.O.D.
Department of
Information Technology | Dr. M. S. Rohokale
Principal
SAE, Pune |
| --- | --- | --- |
| Place: Pune
Date:      /      / 2026 | External Examiner | PROF. R. R. YADAV
Project Coordinator |
| --- | --- | --- |
| Project Group Member | Signature |
| --- | --- |
| Mr. Aditya Shirsat | __________________ |
| Mr. Atharva Lole | __________________ |
| Ms. Neha Kamble | __________________ |
| Mr. Sourabh Shirkande | __________________ |
| MR. ADITYA SHIRSAT | EXAM NO: B400430407 |
| --- | --- |
| MR. ATHARVA LOLE | EXAM NO: B400430382 |
| MS. NEHA KAMBLE | EXAM NO: B400430371 |
| MR. SOURABH SHIRKANDE | EXAM NO: B400430406 |