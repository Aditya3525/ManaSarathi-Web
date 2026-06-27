import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { userFindUniqueMock, userUpdateMock } = vi.hoisted(() => ({
  userFindUniqueMock: vi.fn(),
  userUpdateMock: vi.fn(),
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => ({
    user: {
      findUnique: userFindUniqueMock,
      update: userUpdateMock,
    },
  })),
}));

vi.mock('../src/middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    if (req.headers.authorization === 'Bearer valid-token') {
      req.user = { id: 'user1', email: 'user@example.com' };
      next();
      return;
    }
    res.status(401).json({ success: false, error: 'Access denied. No token provided.' });
  },
}));

import privacyRoutes from '../src/routes/privacy';
import { errorHandler } from '../src/middleware/errorHandler';

const app = express();
app.use(express.json());
app.use('/api/privacy', privacyRoutes);
app.use(errorHandler);

describe('Privacy API', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    userFindUniqueMock.mockResolvedValue({
      dataConsent: true,
      clinicianSharing: false,
      anonymousAnalytics: true,
      marketingEmails: false,
      researchParticipation: false,
      consentUpdatedAt: new Date('2026-03-26T10:00:00.000Z'),
    });

    userUpdateMock.mockResolvedValue({
      dataConsent: false,
      clinicianSharing: true,
      anonymousAnalytics: false,
      marketingEmails: false,
      researchParticipation: false,
      consentUpdatedAt: new Date('2026-03-26T10:00:00.000Z'),
    });
  });

  it('returns privacy settings for an authenticated user', async () => {
    const response = await request(app)
      .get('/api/privacy/settings')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.dataSharing).toBe(true);
    expect(response.body.data.clinicianAccess).toBe(false);
  });

  it('updates privacy settings for an authenticated user', async () => {
    const response = await request(app)
      .put('/api/privacy/settings')
      .set('Authorization', 'Bearer valid-token')
      .send({
        dataSharing: false,
        clinicianAccess: true,
        anonymousAnalytics: false,
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(userUpdateMock).toHaveBeenCalled();
  });

  it('returns 401 when no auth token is provided', async () => {
    const response = await request(app).get('/api/privacy/settings');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });
});
