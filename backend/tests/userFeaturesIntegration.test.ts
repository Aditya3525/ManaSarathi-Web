import { describe, it, beforeAll, afterAll, expect, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import path from 'path';
import fs from 'fs';
import { prisma } from '../src/config/database';

// Mock LLM provider to avoid calling external API and keep tests fast and resilient
vi.mock('../src/services/llmProvider', () => ({
  LLMService: vi.fn(() => ({
    generateResponse: vi.fn(() => Promise.resolve({ content: 'AI analysis of wellbeing' })),
    getProviderStatus: vi.fn(() => Promise.resolve({})),
  })),
  llmService: {
    generateResponse: vi.fn(() => Promise.resolve({ content: 'AI analysis of wellbeing' })),
    getProviderStatus: vi.fn(() => Promise.resolve({})),
  },
}));

const resolveDatabaseUrl = (): string | null => {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) return null;

  if (!raw.startsWith('file:')) {
    return raw;
  }

  const filePath = raw.slice('file:'.length);
  if (!filePath.startsWith('./') && !filePath.startsWith('../')) {
    return raw;
  }

  const absolutePath = path.resolve(process.cwd(), filePath).replace(/\\/g, '/');
  return `file:${absolutePath}`;
};

const resolvedDatabaseUrl = resolveDatabaseUrl();
if (resolvedDatabaseUrl) {
  process.env.DATABASE_URL = resolvedDatabaseUrl;
}

describe('User Features Integration Flow', () => {
  let app: Express;
  const testEmail = `integration-test-${Date.now()}@example.com`;
  const testPassword = 'Tester@Password123';
  let token: string;
  let userId: string;
  let conversationId: string;
  let sessionId: string;
  let assessmentId = 'anxiety_gad2';

  beforeAll(async () => {
    // 1. Initialize Express App
    const module = await import('../src/server');
    app = module.default;

    // 2. Ensure test assessment category exists in database
    await prisma.assessmentDefinition.upsert({
      where: { id: assessmentId },
      update: {},
      create: {
        id: assessmentId,
        name: 'Anxiety Assessment (GAD-2)',
        type: 'Standard',
        category: 'mental_health',
        description: 'Generalized Anxiety Disorder 2-item assessment',
        timeEstimate: '2 mins',
        isActive: true,
        visibleInMainList: true,
      } as any
    });
  });

  afterAll(async () => {
    // Cleanup any lingering database state for this user (if not already deleted)
    try {
      const user = await prisma.user.findUnique({ where: { email: testEmail } });
      if (user) {
        await prisma.user.delete({ where: { id: user.id } });
      }
    } catch (err) {
      // Ignore if user already deleted by tests
    }
    await prisma.$disconnect();
  });

  it('Stage 1: User Registration', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: testPassword,
        name: 'Integration Tester User',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.email).toBe(testEmail);

    token = res.body.data.token;
    userId = res.body.data.user.id;
  });

  it('Stage 2: User Authentication & Token Validation', async () => {
    // Test login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: testEmail,
        password: testPassword,
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.data.token).toBeDefined();

    // Test token validation endpoint
    const validateRes = await request(app)
      .post('/api/auth/validate')
      .set('Authorization', `Bearer ${token}`);

    expect(validateRes.status).toBe(200);
    expect(validateRes.body.email).toBe(testEmail);
  });

  it('Stage 3: Onboarding Completion', async () => {
    const res = await request(app)
      .post('/api/users/complete-onboarding')
      .set('Authorization', `Bearer ${token}`)
      .send({
        firstName: 'Integration',
        lastName: 'Tester',
        approach: 'hybrid',
        region: 'India',
        dataConsent: true,
        clinicianSharing: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('Stage 4: Mood Logging & History Stats', async () => {
    // Log mood
    const logRes = await request(app)
      .post('/api/mood')
      .set('Authorization', `Bearer ${token}`)
      .send({
        mood: 'Good',
        notes: 'Feeling great during automated testing!',
      });

    expect(logRes.status).toBe(201);
    expect(logRes.body.success).toBe(true);
    expect(logRes.body.data.mood).toBe('Good');

    // Fetch stats
    const statsRes = await request(app)
      .get('/api/mood/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(statsRes.status).toBe(200);
    expect(statsRes.body.success).toBe(true);
    expect(statsRes.body.data.totalEntries).toBeGreaterThanOrEqual(1);
    expect(statsRes.body.data.currentStreak).toBeGreaterThanOrEqual(1);
  });

  it('Stage 5: Chatbot AI Companion Interactions', async () => {
    // Start Chatbot Conversation
    const startRes = await request(app)
      .post('/api/chatbot/conversations/start')
      .set('Authorization', `Bearer ${token}`);

    expect(startRes.status).toBe(201);
    expect(startRes.body.success).toBe(true);
    expect(startRes.body.data.conversationId).toBeDefined();
    conversationId = startRes.body.data.conversationId;

    // Send Message
    const msgRes = await request(app)
      .post(`/api/chatbot/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        role: 'user',
        content: 'Help me feel more relaxed.',
      });

    expect(msgRes.status).toBe(200);
    expect(msgRes.body.success).toBe(true);

    // End Conversation
    const endRes = await request(app)
      .post(`/api/chatbot/conversations/${conversationId}/end`)
      .set('Authorization', `Bearer ${token}`);

    expect(endRes.status).toBe(200);
    expect(endRes.body.success).toBe(true);

    // Retrieve Conversation detail
    const detailRes = await request(app)
      .get(`/api/chatbot/conversations/${conversationId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.success).toBe(true);
    expect(detailRes.body.data.userId).toBe(userId);

    // Retrieve chatbot stats
    const statsRes = await request(app)
      .get('/api/chatbot/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(statsRes.status).toBe(200);
    expect(statsRes.body.success).toBe(true);
    expect(statsRes.body.data.totalConversations).toBeGreaterThanOrEqual(1);
  });

  it('Stage 6: Clinical Assessments Flow', async () => {
    // Start Assessment Session - status 200 on success
    const startSessionRes = await request(app)
      .post('/api/assessments/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        selectedTypes: [assessmentId],
      });

    expect(startSessionRes.status).toBe(200);
    expect(startSessionRes.body.success).toBe(true);
    expect(startSessionRes.body.data.session.id).toBeDefined();
    sessionId = startSessionRes.body.data.session.id;

    // Retrieve available assessments
    const availableRes = await request(app)
      .get('/api/assessments/available')
      .set('Authorization', `Bearer ${token}`);

    expect(availableRes.status).toBe(200);
    expect(availableRes.body.success).toBe(true);

    // Submit Assessment Responses
    const submitRes = await request(app)
      .post('/api/assessments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        assessmentType: assessmentId,
        responses: {
          gad2_q1: 2,
          gad2_q2: 1
        }
      });

    expect(submitRes.status).toBe(201);
    expect(submitRes.body.success).toBe(true);
    expect(submitRes.body.data.assessment).toBeDefined();
    expect(submitRes.body.data.assessment.score).toBeDefined();

    // Complete Session Status
    const updateRes = await request(app)
      .patch(`/api/assessments/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'completed',
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.success).toBe(true);
  });

  it('Stage 7: Dashboard Summary Retrieval & Profile Update', async () => {
    // Fetch Dashboard
    const dashboardRes = await request(app)
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(dashboardRes.status).toBe(200);
    expect(dashboardRes.body.user.id).toBe(userId);

    // Update Profile Detail
    const updateProfileRes = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        lastName: 'UpdatedTester',
      });

    expect(updateProfileRes.status).toBe(200);
    expect(updateProfileRes.body.success).toBe(true);
  });

  it('Stage 8: Privacy Data Export & Account Deletion', async () => {
    // Export user data - returns raw data payload directly
    const exportRes = await request(app)
      .post('/api/privacy/export-data')
      .set('Authorization', `Bearer ${token}`)
      .send({
        format: 'json',
      });

    expect(exportRes.status).toBe(200);
    expect(exportRes.body.exportFormat).toBe('json');
    expect(exportRes.body.sectionsIncluded).toContain('profile');

    // Delete account (permanently cleans up related records and user record)
    const deleteRes = await request(app)
      .post('/api/privacy/delete-account')
      .set('Authorization', `Bearer ${token}`)
      .send({
        confirmation: 'DELETE',
      });

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);

    // Verify user no longer exists in database
    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user).toBeNull();
  });
});
