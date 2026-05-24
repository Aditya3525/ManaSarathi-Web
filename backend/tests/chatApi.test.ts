/**
 * Chat API Tests
 * Tests POST /api/chat/message, GET /api/chat/starters, GET /api/chatbot/check-in
 */
import request from 'supertest';
import type { Express } from 'express';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { llmService } from '../src/services/llmProvider';

// --- Prisma mock ---
const createMessageMock = vi.fn((args: any) =>
    Promise.resolve({ id: 'msg1', ...args.data, createdAt: new Date() })
);
const findManyMessagesMock = vi.fn(() => Promise.resolve([]));
const createConversationMock = vi.fn((args: any) =>
    Promise.resolve({ id: 'conv1', ...args.data, createdAt: new Date(), updatedAt: new Date() })
);
const findUniqueConversationMock = vi.fn(() => Promise.resolve(null));
const updateConversationMock = vi.fn(() => Promise.resolve({}));
const findManyConvMock = vi.fn(() => Promise.resolve([]));

vi.mock('@prisma/client', () => ({
    PrismaClient: vi.fn(() => ({
        chatMessage: {
            create: createMessageMock,
            findMany: findManyMessagesMock,
            findFirst: vi.fn(() => Promise.resolve(null)),
            count: vi.fn(() => Promise.resolve(0)),
        },
        crisisEvent: {
            create: vi.fn((args: any) => Promise.resolve({ id: 'crisis1', ...args.data, detectedAt: new Date() })),
        },
        conversation: {
            create: createConversationMock,
            findUnique: findUniqueConversationMock,
            findFirst: vi.fn(() => Promise.resolve(null)),
            findMany: findManyConvMock,
            update: updateConversationMock,
            count: vi.fn(() => Promise.resolve(0)),
        },
        chatbotConversation: {
            findMany: vi.fn(() => Promise.resolve([])),
            create: vi.fn((args: any) => Promise.resolve({ id: 'cbc1', ...args.data })),
            findFirst: vi.fn(() => Promise.resolve(null)),
            update: vi.fn(() => Promise.resolve({})),
        },
        conversationMemory: {
            findUnique: vi.fn(() => Promise.resolve(null)),
            upsert: vi.fn(() => Promise.resolve({})),
        },
        conversationGoal: {
            findMany: vi.fn(() => Promise.resolve([])),
        },
        dailyIntention: {
            findFirst: vi.fn(() => Promise.resolve(null)),
        },
        sleepLog: {
            findMany: vi.fn(() => Promise.resolve([])),
        },
        chatFeedback: {
            findMany: vi.fn(() => Promise.resolve([])),
            findFirst: vi.fn(() => Promise.resolve(null)),
            upsert: vi.fn(() => Promise.resolve({})),
        },
        user: {
            findUnique: vi.fn(() =>
                Promise.resolve({
                    id: 'user1',
                    firstName: 'Test',
                    name: 'Test User',
                    approach: 'western',
                })
            ),
        },
        moodEntry: {
            findMany: vi.fn(() => Promise.resolve([])),
        },
        contentEngagement: {
            count: vi.fn(() => Promise.resolve(0)),
            findMany: vi.fn(() => Promise.resolve([])),
        },
        content: {
            findMany: vi.fn(() => Promise.resolve([])),
        },
        practice: {
            findMany: vi.fn(() => Promise.resolve([])),
        },
        assessmentResult: {
            findMany: vi.fn(() => Promise.resolve([])),
        },
        $queryRaw: vi.fn(() => Promise.resolve([{ ok: 1 }])),
    })),
}));

vi.mock('../src/config/database', () => {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    return { prisma, default: prisma };
});

vi.mock('../src/middleware/auth', () => ({
    authenticate: (req: any, _res: any, next: any) => {
        req.user = { id: 'user1', email: 'test@test.com' };
        next();
    },
}));

vi.mock('../src/services/llmProvider', () => ({
    LLMService: vi.fn(() => ({
        generateResponse: vi.fn(() =>
            Promise.resolve({ content: 'Hello! How can I help you today?' })
        ),
        getProviderStatus: vi.fn(() => Promise.resolve({})),
    })),
    llmService: {
        generateResponse: vi.fn(() =>
            Promise.resolve({ content: 'Hello! How can I help you today?' })
        ),
        getProviderStatus: vi.fn(() => Promise.resolve({})),
    },
}));

vi.mock('../src/services/progressDetectionService', () => ({
    progressDetectionService: {
        detectProgress: vi.fn(() => Promise.resolve([])),
    },
}));

vi.mock('../src/services/recommendationService', () => ({
    recommendationService: {
        getContentRecommendations: vi.fn(() =>
            Promise.resolve({
                items: [],
                focusAreas: [],
                rationale: 'mocked recommendations',
                fallbackUsed: false,
            })
        ),
    },
}));

// Mock chatbot service
vi.mock('../src/services/chatbotService', () => ({
    chatbotService: {
        processMessage: vi.fn(() =>
            Promise.resolve({
                response: 'I understand you\'re looking for help. How can I assist?',
                smartReplies: ['Tell me more', 'I need help with anxiety'],
                conversationId: 'conv1',
            })
        ),
        getConversationStarters: vi.fn(() =>
            Promise.resolve([
                'How are you feeling today?',
                'Tell me about your day',
                'I need help managing stress',
            ])
        ),
    },
}));

let app: Express;

beforeAll(async () => {
    const module = await import('../src/server');
    app = module.default;
}, 60000);

beforeEach(() => {
    createMessageMock.mockClear();
    findManyMessagesMock.mockClear();
    findManyConvMock.mockClear();

    const mockedLlmService = llmService as any;
    mockedLlmService.generateResponse.mockReset();
    mockedLlmService.generateResponse.mockResolvedValue({
        content: 'Hello! How can I help you today?'
    });
    mockedLlmService.getProviderStatus.mockReset();
    mockedLlmService.getProviderStatus.mockResolvedValue({});
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('Chat API', () => {
    describe('POST /api/chat/message', () => {
        it('sends a message and receives a response', async () => {
            const res = await request(app)
                .post('/api/chat/message')
                .send({ content: 'Hello, I need some help' });

            // Should return a response (may be 200 or 201)
            expect(res.status).toBeLessThan(500);
            expect(res.body).toBeDefined();
        });

        it('does not trigger crisis mode for routine stress language', async () => {
            const res = await request(app)
                .post('/api/chat/message')
                .send({ content: 'I am stressed about exams and cannot focus lately.' });

            expect(res.status).toBe(201);
            expect(res.body?.data?.crisis).not.toBe(true);
        });

        it('triggers crisis mode for explicit self-harm language', async () => {
            const res = await request(app)
                .post('/api/chat/message')
                .send({ content: 'I want to kill myself tonight.' });

            expect(res.status).toBe(201);
            expect(res.body?.data?.crisis).toBe(true);
            expect(typeof res.body?.data?.message?.content).toBe('string');
            expect(res.body?.data?.message?.type).toBe('system');
        });

        it('replaces over-cautious self-harm refusals for non-crisis prompts', async () => {
            const mockedLlmService = llmService as any;
            mockedLlmService.generateResponse.mockResolvedValueOnce({
                content:
                    "I can't provide you with assistance in harming yourself. If you’re experiencing thoughts of self-harm or suicide, I encourage you to seek help immediately."
            });

            const res = await request(app)
                .post('/api/chat/message')
                .send({ content: 'I feel lonely since my daughter moved out and evenings feel quiet.' });

            const messageContent = String(res.body?.data?.message?.content || '').toLowerCase();

            expect(res.status).toBe(201);
            expect(res.body?.data?.crisis).not.toBe(true);
            expect(messageContent).not.toContain('self-harm or suicide');
            expect(messageContent).not.toContain('harming yourself');
        });

        it('replaces terse generic refusals for non-crisis prompts', async () => {
            const mockedLlmService = llmService as any;
            mockedLlmService.generateResponse.mockResolvedValueOnce({
                content: "I can't help with that."
            });

            const res = await request(app)
                .post('/api/chat/message')
                .send({ content: 'I am struggling to calm down after a stressful day at work.' });

            const messageContent = String(res.body?.data?.message?.content || '').toLowerCase();

            expect(res.status).toBe(201);
            expect(res.body?.data?.crisis).not.toBe(true);
            expect(messageContent).not.toBe("i can't help with that.");
        });

        it('rejects empty message', async () => {
            const res = await request(app)
                .post('/api/chat/message')
                .send({ content: '' });

            // Should fail validation
            expect(res.status).toBeGreaterThanOrEqual(400);
        });
    });

    describe('GET /api/chat/starters', () => {
        it('returns conversation starters', async () => {
            const res = await request(app).get('/api/chat/starters');

            expect(res.status).toBeLessThan(500);
            expect(res.body).toBeDefined();
        });
    });

    describe('Conversations API', () => {
        it('GET /api/conversations returns conversations list', async () => {
            const res = await request(app).get('/api/conversations');

            expect(res.status).toBe(200);
            expect(res.body).toBeDefined();
        });

        it('GET /api/chat/conversations returns conversations list via compatibility alias', async () => {
            const res = await request(app).get('/api/chat/conversations');

            expect(res.status).toBe(200);
            expect(res.body).toBeDefined();
        });
    });
});
