import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

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
  const parentDir = path.dirname(absolutePath);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  return `file:${absolutePath}`;
};

const resolvedDatabaseUrl = resolveDatabaseUrl();
if (resolvedDatabaseUrl) {
  process.env.DATABASE_URL = resolvedDatabaseUrl;
}

const hasDatabaseUrl = Boolean(resolvedDatabaseUrl);
const prisma = hasDatabaseUrl ? new PrismaClient() : null;
let app: Express;

const maybeDescribe = hasDatabaseUrl ? describe : describe.skip;

maybeDescribe('Admin auth session flow', () => {
  const adminEmail = 'admin@mentalwellbeing.ai';
  let createdUserId: string | null = null;

  beforeAll(async () => {
    if (!prisma) {
      return;
    }

    const module = await import('../src/server');
    app = module.default;

    // Ensure admin user exists with correct password
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const user = await prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        password: hashedPassword,
      },
      create: {
        email: adminEmail,
        name: 'Test Admin',
        password: hashedPassword,
        isOnboarded: true,
        dataConsent: true,
      },
    });
    createdUserId = user.id;
  }, 60000);

  afterAll(async () => {
    // Leave user in DB for other tests; just disconnect prisma
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  it('logs in and then returns session details', async () => {
    const agent = request.agent(app);

    const loginRes = await agent
      .post('/api/admin/login')
      .set('Origin', 'http://localhost:3000')
      .set('Accept', 'application/json')
      .send({ email: adminEmail, password: 'admin123' })
      .expect(200);

    expect(loginRes.body).toBeDefined();
    expect(loginRes.body.email).toBe(adminEmail);

    const sessionRes = await agent
      .get('/api/admin/session')
      .set('Origin', 'http://localhost:3000')
      .set('Accept', 'application/json')
      .expect(200);

    expect(sessionRes.body).toBeDefined();
    expect(sessionRes.body.email).toBe(adminEmail);
    expect(sessionRes.body.role).toBe('Admin');
  });
});
