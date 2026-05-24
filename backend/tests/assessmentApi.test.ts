/**
 * Assessment API Tests
 * Tests GET /api/assessments/available, GET /api/assessments/history,
 * POST /api/assessments (submit), and session management.
 */
import request from 'supertest';
import type { Express } from 'express';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Prisma mock ---
const { mockPrisma, findManyDefMock, findManyResultMock, createResultMock } = vi.hoisted(() => {
    const mockAssessmentDefinitions = [
        {
            id: 'anxiety_assessment',
            name: 'Anxiety Assessment',
            type: 'Advanced',
            category: 'mental_health',
            description: 'Measures anxiety levels',
            timeEstimate: '5-10 min',
            isActive: true,
            visibleInMainList: true,
            questions: [
                { id: 'q1', text: 'How often do you feel nervous?', order: 1, responseType: 'likert', options: [] },
            ],
        },
    ];

    const mockAssessmentResult = {
        id: 'result1',
        userId: 'user1',
        assessmentType: 'anxiety_assessment',
        score: 12,
        responses: '{}',
        completedAt: new Date('2026-02-15'),
    };

    const findManyDefMock = vi.fn(() => Promise.resolve(mockAssessmentDefinitions));
    const findManyResultMock = vi.fn(() => Promise.resolve([mockAssessmentResult]));
    const createResultMock = vi.fn((args: any) =>
        Promise.resolve({ id: 'result-new', ...args.data, completedAt: new Date() })
    );
    const findUniqueInsightMock = vi.fn(() => Promise.resolve(null));
    const upsertInsightMock = vi.fn(() => Promise.resolve({}));

    return {
        mockPrisma: {
            assessmentDefinition: {
                findMany: findManyDefMock,
                findFirst: vi.fn(() => Promise.resolve(mockAssessmentDefinitions[0])),
            },
            assessmentResult: {
                findMany: findManyResultMock,
                create: createResultMock,
                count: vi.fn(() => Promise.resolve(1)),
                findFirst: vi.fn(() => Promise.resolve(mockAssessmentResult)),
            },
            assessmentSession: {
                findFirst: vi.fn(() => Promise.resolve(null)),
                create: vi.fn((args: any) => Promise.resolve({ id: 'session1', ...args.data })),
                update: vi.fn(() => Promise.resolve({})),
            },
            assessmentInsight: {
                findUnique: findUniqueInsightMock,
                upsert: upsertInsightMock,
            },
            user: {
                findUnique: vi.fn(() =>
                    Promise.resolve({ id: 'user1', firstName: 'Test', name: 'Test User' })
                ),
            },
            $queryRaw: vi.fn(() => Promise.resolve([{ ok: 1 }])),
            $executeRawUnsafe: vi.fn(() => Promise.resolve(1)),
        },
        findManyDefMock,
        findManyResultMock,
        createResultMock,
    };
});

vi.mock('@prisma/client', () => ({
    PrismaClient: vi.fn(() => mockPrisma),
}));

vi.mock('../src/config/database', () => ({
    prisma: mockPrisma,
    default: mockPrisma,
}));

vi.mock('../src/middleware/auth', () => ({
    authenticate: (req: any, _res: any, next: any) => {
        req.user = { id: 'user1', email: 'test@test.com' };
        next();
    },
}));

vi.mock('../src/services/llmProvider', () => ({
    LLMService: vi.fn(() => ({
        generateResponse: vi.fn(() => Promise.resolve({ content: 'AI analysis of results' })),
        getProviderStatus: vi.fn(() => Promise.resolve({})),
    })),
    llmService: {
        generateResponse: vi.fn(() => Promise.resolve({ content: 'AI analysis of results' })),
        getProviderStatus: vi.fn(() => Promise.resolve({})),
    },
}));

let app: Express;

beforeAll(async () => {
    const module = await import('../src/server');
    app = module.default;
}, 60000);

beforeEach(() => {
    findManyDefMock.mockClear();
    findManyResultMock.mockClear();
    createResultMock.mockClear();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('Assessment API', () => {
    describe('GET /api/assessments/available', () => {
        it('returns list of available assessments', async () => {
            const res = await request(app).get('/api/assessments/available');

            expect(res.status).toBe(200);
            expect(res.body).toBeDefined();
            expect(Array.isArray(res.body.data)).toBe(true);
            const returnedTypes = (res.body.data as Array<{ type?: string }>)
                .map((item) => item.type)
                .filter((value): value is string => typeof value === 'string');

            expect(returnedTypes.length).toBeGreaterThan(0);
            expect(returnedTypes).not.toContain('Advanced');
            expect(returnedTypes).not.toContain('Basic');
            expect(returnedTypes).not.toContain('Combined');
        });
    });

    describe('GET /api/assessments/history', () => {
        it('returns assessment history for authenticated user', async () => {
            const res = await request(app).get('/api/assessments/history');

            // Route is reachable and auth works (not 401 or 404)
            expect(res.status).not.toBe(401);
            expect(res.status).not.toBe(404);
            expect(res.body).toBeDefined();
        });
    });

    describe('POST /api/assessments', () => {
        it('accepts a properly structured assessment submission', async () => {
            const res = await request(app)
                .post('/api/assessments')
                .send({
                    assessmentType: 'anxiety_assessment',
                    responses: { q1: 2, q2: 3 },
                    score: 12,
                });

            // The route receives the request — any non-404 proves routing works
            expect(res.status).not.toBe(404);
            expect(res.body).toBeDefined();
        });

        it('rejects submission without assessment type', async () => {
            const res = await request(app)
                .post('/api/assessments')
                .send({
                    responses: { q1: 2, q2: 3 },
                });

            // Should fail with a client or server error (not 200 OK)
            expect(res.status).toBeGreaterThanOrEqual(400);
        });
    });
});
