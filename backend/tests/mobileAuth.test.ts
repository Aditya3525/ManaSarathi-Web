import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import axios from 'axios';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('../src/config/database', () => ({
  prisma: prismaMock,
  default: prismaMock,
}));

vi.mock('axios');

let app: Express;

beforeAll(async () => {
  const module = await import('../src/server');
  app = module.default;
});

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Mobile Google Authentication Bypass Fix', () => {
  it('rejects authentication if email or googleId are missing', async () => {
    const res = await request(app)
      .post('/api/auth/google/mobile')
      .send({ email: 'test@example.com' }); // missing googleId

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Email and googleId are required');
  });

  it('rejects authentication if idToken is missing', async () => {
    const res = await request(app)
      .post('/api/auth/google/mobile')
      .send({ email: 'test@example.com', googleId: 'google-123' }); // missing idToken

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('idToken is required');
  });

  it('allows authentication with mock-google-token in non-production environment', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'u1',
      email: 'test@example.com',
      googleId: 'google-123',
      isOnboarded: true,
      password: 'hashed-password',
    });

    const res = await request(app)
      .post('/api/auth/google/mobile')
      .send({
        email: 'test@example.com',
        googleId: 'google-123',
        idToken: 'mock-google-token',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
  });

  it('calls tokeninfo API and rejects on invalid token signature/expiration', async () => {
    vi.mocked(axios.get).mockRejectedValueOnce(new Error('Invalid token'));

    const res = await request(app)
      .post('/api/auth/google/mobile')
      .send({
        email: 'test@example.com',
        googleId: 'google-123',
        idToken: 'invalid-token-123',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Invalid Google ID token');
  });

  it('rejects on Google ID token email mismatch', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({
      status: 200,
      data: {
        email: 'different-email@example.com',
        sub: 'google-123',
      },
    } as any);

    const res = await request(app)
      .post('/api/auth/google/mobile')
      .send({
        email: 'test@example.com',
        googleId: 'google-123',
        idToken: 'valid-token-but-different-email',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Google ID token email mismatch');
  });

  it('rejects on Google ID token sub mismatch', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({
      status: 200,
      data: {
        email: 'test@example.com',
        sub: 'different-google-id',
      },
    } as any);

    const res = await request(app)
      .post('/api/auth/google/mobile')
      .send({
        email: 'test@example.com',
        googleId: 'google-123',
        idToken: 'valid-token-but-different-sub',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Google ID token sub mismatch');
  });

  it('accepts and registers user on valid verified Google token payload', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({
      status: 200,
      data: {
        email: 'test@example.com',
        sub: 'google-123',
      },
    } as any);

    prismaMock.user.findUnique.mockResolvedValueOnce(null); // new user
    prismaMock.user.create.mockResolvedValueOnce({
      id: 'u1',
      email: 'test@example.com',
      googleId: 'google-123',
      name: 'Test User',
      isOnboarded: false,
    });

    const res = await request(app)
      .post('/api/auth/google/mobile')
      .send({
        email: 'test@example.com',
        googleId: 'google-123',
        idToken: 'valid-signed-token',
        name: 'Test User',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('test@example.com');
    expect(res.body.data.token).toBeDefined();
  });
});
