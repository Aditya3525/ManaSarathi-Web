import express from 'express';
import { PrismaClient } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { authenticate } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// All routes require authentication
router.use(authenticate as any);

/**
 * GET /api/privacy/settings
 * Returns the user's current privacy settings
 */
router.get('/settings', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        dataConsent: true,
        clinicianSharing: true,
        anonymousAnalytics: true,
        marketingEmails: true,
        researchParticipation: true,
        consentUpdatedAt: true
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({
      success: true,
      data: {
        dataSharing: user.dataConsent,
        clinicianAccess: user.clinicianSharing,
        anonymousAnalytics: user.anonymousAnalytics != null ? Boolean(user.anonymousAnalytics) : true,
        marketingEmails: user.marketingEmails != null ? Boolean(user.marketingEmails) : false,
        researchParticipation: user.researchParticipation != null ? Boolean(user.researchParticipation) : false,
        consentUpdatedAt: user.consentUpdatedAt ? user.consentUpdatedAt.toISOString() : null,
      },
    });
  } catch (error) {
    console.error('Get privacy settings error:', error);
    res.status(500).json({ success: false, error: 'Failed to load privacy settings' });
  }
});

/**
 * PUT /api/privacy/settings
 * Updates the user's privacy settings
 */
router.put('/settings', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const { dataSharing, clinicianAccess, anonymousAnalytics, marketingEmails, researchParticipation } = req.body;

    const updateData: any = {
      consentUpdatedAt: new Date()
    };
    if (dataSharing !== undefined) updateData.dataConsent = dataSharing;
    if (clinicianAccess !== undefined) updateData.clinicianSharing = clinicianAccess;
    if (anonymousAnalytics !== undefined) updateData.anonymousAnalytics = anonymousAnalytics;
    if (marketingEmails !== undefined) updateData.marketingEmails = marketingEmails;
    if (researchParticipation !== undefined) updateData.researchParticipation = researchParticipation;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        dataConsent: true,
        clinicianSharing: true,
        anonymousAnalytics: true,
        marketingEmails: true,
        researchParticipation: true,
        consentUpdatedAt: true
      }
    });

    res.json({
      success: true,
      data: {
        dataSharing: Boolean(updatedUser.dataConsent),
        clinicianAccess: Boolean(updatedUser.clinicianSharing),
        anonymousAnalytics: updatedUser.anonymousAnalytics != null ? Boolean(updatedUser.anonymousAnalytics) : true,
        marketingEmails: updatedUser.marketingEmails != null ? Boolean(updatedUser.marketingEmails) : false,
        researchParticipation: updatedUser.researchParticipation != null ? Boolean(updatedUser.researchParticipation) : false,
        consentUpdatedAt: updatedUser.consentUpdatedAt ? updatedUser.consentUpdatedAt.toISOString() : null,
      },
    });
  } catch (error) {
    console.error('Update privacy settings error:', error);
    res.status(500).json({ success: false, error: 'Failed to update privacy settings' });
  }
});

/**
 * POST /api/privacy/export-data
 * Exports user data in JSON, Text, or PDF format.
 * Body: { format?: 'json' | 'text' | 'pdf', sections?: string[] }
 * Valid sections: profile, assessments, moodEntries, conversations, goals, progress
 */
router.post('/export-data', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const format: string = (req.body.format || 'json').toLowerCase();
    const allSections = [
      'profile', 'assessments', 'moodEntries', 'conversations', 'goals', 'progress',
      'insights', 'memory', 'contentActivity', 'safetyPlan', 'supportTickets',
      'sessions', 'chatbotConversations', 'bookingsCrisis',
    ];
    const requestedSections: string[] = Array.isArray(req.body.sections) && req.body.sections.length > 0
      ? req.body.sections.filter((s: string) => allSections.includes(s))
      : allSections;

    if (!['json', 'text', 'pdf'].includes(format)) {
      return res.status(400).json({ success: false, error: 'Invalid format. Use json, text, or pdf.' });
    }

    // ── Gather data from DB ──
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, name: true, firstName: true, lastName: true,
        isOnboarded: true, approach: true, birthday: true, gender: true,
        region: true, language: true, emergencyContact: true, emergencyPhone: true,
        dataConsent: true, clinicianSharing: true, createdAt: true, updatedAt: true,
      },
    });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const privacyRaw = await prisma.$queryRaw<Array<any>>`SELECT "anonymousAnalytics", "marketingEmails", "researchParticipation", "consentUpdatedAt" FROM "users" WHERE "id" = ${userId}`;
    const privacyExtra = privacyRaw[0] || {};

    // Fetch only requested sections in parallel
    const [
      assessments, moodEntries, conversations, goals, progressTracking,
      assessmentInsight, dashboardInsights, wellnessSnapshots,
      conversationMemory, contentEngagements, userPlanModules,
      safetyPlan, supportTickets, userSessions, assessmentSessions,
      chatbotConversations, therapistBookings, crisisEvents,
    ] = await Promise.all([
      requestedSections.includes('assessments')
        ? prisma.assessmentResult.findMany({
            where: { userId }, orderBy: { completedAt: 'desc' },
            select: { id: true, assessmentType: true, score: true, responses: true, categoryScores: true, completedAt: true },
          })
        : Promise.resolve([]),
      requestedSections.includes('moodEntries')
        ? prisma.moodEntry.findMany({
            where: { userId }, orderBy: { createdAt: 'desc' },
            select: { id: true, mood: true, notes: true, createdAt: true },
          })
        : Promise.resolve([]),
      requestedSections.includes('conversations')
        ? prisma.conversation.findMany({
            where: { userId }, orderBy: { updatedAt: 'desc' },
            select: {
              id: true, title: true, createdAt: true, updatedAt: true,
              messages: { select: { id: true, type: true, content: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
            },
          })
        : Promise.resolve([]),
      requestedSections.includes('goals')
        ? prisma.conversationGoal.findMany({
            where: { userId }, orderBy: { updatedAt: 'desc' },
            select: { id: true, goalType: true, title: true, description: true, progress: true, status: true, milestones: true, createdAt: true, updatedAt: true, completedAt: true },
          })
        : Promise.resolve([]),
      requestedSections.includes('progress')
        ? prisma.progressTracking.findMany({
            where: { userId }, orderBy: { date: 'desc' },
            select: { id: true, date: true, metric: true, value: true, notes: true },
          })
        : Promise.resolve([]),
      // ── New sections ──
      requestedSections.includes('insights')
        ? prisma.assessmentInsight.findUnique({
            where: { userId },
            select: { summary: true, overallTrend: true, aiSummary: true, wellnessScore: true, updatedAt: true },
          })
        : Promise.resolve(null),
      requestedSections.includes('insights')
        ? prisma.dashboardInsights.findUnique({
            where: { userId },
            select: { insightsData: true, aiSummary: true, assessmentCount: true, chatCount: true, lastAssessmentDate: true, lastChatDate: true, generatedAt: true },
          })
        : Promise.resolve(null),
      requestedSections.includes('insights')
        ? prisma.wellnessSnapshot.findMany({
            where: { userId }, orderBy: { recordedAt: 'desc' },
            select: { wellnessScore: true, assessmentScores: true, moodAverage: true, engagementLevel: true, recordedAt: true, periodStart: true, periodEnd: true },
          })
        : Promise.resolve([]),
      requestedSections.includes('memory')
        ? prisma.conversationMemory.findUnique({
            where: { userId },
            select: { topics: true, emotionalPatterns: true, importantMoments: true, conversationMetrics: true, updatedAt: true },
          })
        : Promise.resolve(null),
      requestedSections.includes('contentActivity')
        ? prisma.contentEngagement.findMany({
            where: { userId }, orderBy: { createdAt: 'desc' },
            select: { contentId: true, completed: true, rating: true, timeSpent: true, moodBefore: true, moodAfter: true, effectiveness: true, notes: true, createdAt: true,
              content: { select: { title: true, type: true } },
            },
          })
        : Promise.resolve([]),
      requestedSections.includes('contentActivity')
        ? prisma.userPlanModule.findMany({
            where: { userId }, orderBy: { updatedAt: 'desc' },
            select: { completed: true, progress: true, scheduledFor: true, completedAt: true, notes: true, createdAt: true, updatedAt: true,
              module: { select: { title: true, type: true, difficulty: true } },
            },
          })
        : Promise.resolve([]),
      requestedSections.includes('safetyPlan')
        ? prisma.safetyPlan.findUnique({
            where: { userId },
            select: { warningSignsJson: true, copingStrategiesJson: true, contactsJson: true, therapistName: true, therapistPhone: true, psychiatristName: true, psychiatristPhone: true, emergencyRoom: true, crisisLine: true, safeEnvironmentJson: true, reasonsToLiveJson: true, updatedAt: true },
          })
        : Promise.resolve(null),
      requestedSections.includes('supportTickets')
        ? prisma.supportTicket.findMany({
            where: { userId }, orderBy: { createdAt: 'desc' },
            select: { id: true, subject: true, message: true, category: true, priority: true, status: true, response: true, respondedAt: true, createdAt: true, closedAt: true },
          })
        : Promise.resolve([]),
      requestedSections.includes('sessions')
        ? prisma.userSession.findMany({
            where: { userId }, orderBy: { startedAt: 'desc' },
            select: { startedAt: true, endedAt: true, duration: true, pagesViewed: true, actionsPerformed: true, featuresUsed: true, deviceType: true },
          })
        : Promise.resolve([]),
      requestedSections.includes('sessions')
        ? prisma.assessmentSession.findMany({
            where: { userId }, orderBy: { startedAt: 'desc' },
            select: { selectedTypes: true, status: true, startedAt: true, completedAt: true },
          })
        : Promise.resolve([]),
      requestedSections.includes('chatbotConversations')
        ? prisma.chatbotConversation.findMany({
            where: { userId }, orderBy: { updatedAt: 'desc' },
            select: { messages: true, summary: true, emotionalState: true, keyTopics: true, urgencyLevel: true, startedAt: true, endedAt: true },
          })
        : Promise.resolve([]),
      requestedSections.includes('bookingsCrisis')
        ? prisma.therapistBooking.findMany({
            where: { userId }, orderBy: { createdAt: 'desc' },
            select: { preferredDate: true, preferredTime: true, message: true, status: true, createdAt: true,
              therapist: { select: { name: true, credential: true } },
            },
          })
        : Promise.resolve([]),
      requestedSections.includes('bookingsCrisis')
        ? prisma.crisisEvent.findMany({
            where: { userId }, orderBy: { detectedAt: 'desc' },
            select: { crisisLevel: true, confidence: true, indicators: true, actionTaken: true, detectedAt: true, resolved: true, resolvedAt: true },
          })
        : Promise.resolve([]),
    ]);

    const dateStr = new Date().toISOString().split('T')[0];
    const exportPayload: Record<string, any> = {
      exportDate: new Date().toISOString(),
      exportVersion: '2.0',
      exportFormat: format,
      sectionsIncluded: requestedSections,
    };
    if (requestedSections.includes('profile')) exportPayload.profile = { ...user, ...privacyExtra };
    if (requestedSections.includes('assessments')) exportPayload.assessments = assessments;
    if (requestedSections.includes('moodEntries')) exportPayload.moodEntries = moodEntries;
    if (requestedSections.includes('conversations')) exportPayload.conversations = conversations;
    if (requestedSections.includes('goals')) exportPayload.goals = goals;
    if (requestedSections.includes('progress')) exportPayload.progress = progressTracking;
    if (requestedSections.includes('insights')) exportPayload.insights = { assessmentInsight, dashboardInsights, wellnessSnapshots };
    if (requestedSections.includes('memory')) exportPayload.memory = conversationMemory;
    if (requestedSections.includes('contentActivity')) exportPayload.contentActivity = { contentEngagements, planModules: userPlanModules };
    if (requestedSections.includes('safetyPlan')) exportPayload.safetyPlan = safetyPlan;
    if (requestedSections.includes('supportTickets')) exportPayload.supportTickets = supportTickets;
    if (requestedSections.includes('sessions')) exportPayload.sessions = { userSessions, assessmentSessions };
    if (requestedSections.includes('chatbotConversations')) exportPayload.chatbotConversations = chatbotConversations;
    if (requestedSections.includes('bookingsCrisis')) exportPayload.bookingsCrisis = { therapistBookings, crisisEvents };

    // ── JSON format ──
    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="ManaSarathi-export-${dateStr}.json"`);
      return res.json(exportPayload);
    }

    // ── Text format ──
    if (format === 'text') {
      const lines: string[] = [];
      lines.push('═══════════════════════════════════════════════════════════');
      lines.push('                  ManaSarathi — Data Export');
      lines.push('═══════════════════════════════════════════════════════════');
      lines.push(`Export Date : ${exportPayload.exportDate}`);
      lines.push(`Sections   : ${requestedSections.join(', ')}`);
      lines.push('');

      if (exportPayload.profile) {
        const p = exportPayload.profile;
        lines.push('───────────────────────────────────────────────────────────');
        lines.push('  PROFILE');
        lines.push('───────────────────────────────────────────────────────────');
        lines.push(`  Name            : ${p.firstName || ''} ${p.lastName || ''} (${p.name || ''})`);
        lines.push(`  Email           : ${p.email}`);
        lines.push(`  Approach        : ${p.approach || 'Not set'}`);
        lines.push(`  Birthday        : ${p.birthday ? new Date(p.birthday).toLocaleDateString() : 'Not set'}`);
        lines.push(`  Gender          : ${p.gender || 'Not set'}`);
        lines.push(`  Region          : ${p.region || 'Not set'}`);
        lines.push(`  Language        : ${p.language || 'Not set'}`);
        lines.push(`  Emergency       : ${p.emergencyContact || 'None'} ${p.emergencyPhone || ''}`);
        lines.push(`  Data Consent    : ${p.dataConsent ? 'Yes' : 'No'}`);
        lines.push(`  Clinician Share : ${p.clinicianSharing ? 'Yes' : 'No'}`);
        lines.push(`  Member Since    : ${new Date(p.createdAt).toLocaleDateString()}`);
        lines.push('');
      }

      if (exportPayload.assessments?.length) {
        lines.push('───────────────────────────────────────────────────────────');
        lines.push(`  ASSESSMENTS (${exportPayload.assessments.length} records)`);
        lines.push('───────────────────────────────────────────────────────────');
        for (const a of exportPayload.assessments) {
          lines.push(`  • ${a.assessmentType.toUpperCase()} — Score: ${a.score}  |  Date: ${new Date(a.completedAt).toLocaleDateString()}`);
        }
        lines.push('');
      }

      if (exportPayload.moodEntries?.length) {
        lines.push('───────────────────────────────────────────────────────────');
        lines.push(`  MOOD ENTRIES (${exportPayload.moodEntries.length} records)`);
        lines.push('───────────────────────────────────────────────────────────');
        for (const m of exportPayload.moodEntries) {
          lines.push(`  • ${new Date(m.createdAt).toLocaleDateString()}  —  ${m.mood}${m.notes ? '  (' + m.notes + ')' : ''}`);
        }
        lines.push('');
      }

      if (exportPayload.conversations?.length) {
        lines.push('───────────────────────────────────────────────────────────');
        lines.push(`  CONVERSATIONS (${exportPayload.conversations.length} threads)`);
        lines.push('───────────────────────────────────────────────────────────');
        for (const c of exportPayload.conversations) {
          lines.push(`  ┌─ ${c.title || 'Untitled'} (${new Date(c.createdAt).toLocaleDateString()})`);
          for (const msg of (c.messages || [])) {
            const sender = msg.type === 'user' ? 'You' : 'ManaSarathi';
            const time = new Date(msg.createdAt).toLocaleTimeString();
            lines.push(`  │  [${time}] ${sender}: ${msg.content.substring(0, 200)}${msg.content.length > 200 ? '…' : ''}`);
          }
          lines.push('  └─');
          lines.push('');
        }
      }

      if (exportPayload.goals?.length) {
        lines.push('───────────────────────────────────────────────────────────');
        lines.push(`  WELLBEING GOALS (${exportPayload.goals.length} goals)`);
        lines.push('───────────────────────────────────────────────────────────');
        for (const g of exportPayload.goals) {
          lines.push(`  • ${g.title} (${g.goalType}) — ${g.progress}% — ${g.status}`);
          if (g.description) lines.push(`    ${g.description}`);
        }
        lines.push('');
      }

      if (exportPayload.progress?.length) {
        lines.push('───────────────────────────────────────────────────────────');
        lines.push(`  PROGRESS TRACKING (${exportPayload.progress.length} records)`);
        lines.push('───────────────────────────────────────────────────────────');
        for (const p of exportPayload.progress) {
          lines.push(`  • ${new Date(p.date).toLocaleDateString()}  ${p.metric}: ${p.value}${p.notes ? '  — ' + p.notes : ''}`);
        }
        lines.push('');
      }

      // ── New sections — Insights ──
      if (exportPayload.insights) {
        const ins = exportPayload.insights;
        lines.push('───────────────────────────────────────────────────────────');
        lines.push('  INSIGHTS & WELLNESS');
        lines.push('───────────────────────────────────────────────────────────');
        if (ins.assessmentInsight) {
          lines.push(`  Wellness Score  : ${ins.assessmentInsight.wellnessScore}`);
          lines.push(`  Overall Trend   : ${ins.assessmentInsight.overallTrend || '—'}`);
          lines.push(`  AI Summary      : ${ins.assessmentInsight.aiSummary || '—'}`);
          lines.push(`  Summary Data    : ${JSON.stringify(ins.assessmentInsight.summary)}`);
          lines.push(`  Last Updated    : ${ins.assessmentInsight.updatedAt ? new Date(ins.assessmentInsight.updatedAt).toLocaleDateString() : '—'}`);
        }
        if (ins.dashboardInsights) {
          lines.push('');
          lines.push('  Dashboard Insights:');
          lines.push(`    AI Summary         : ${ins.dashboardInsights.aiSummary || '—'}`);
          lines.push(`    Assessment Count   : ${ins.dashboardInsights.assessmentCount}`);
          lines.push(`    Chat Count         : ${ins.dashboardInsights.chatCount}`);
          lines.push(`    Generated At       : ${ins.dashboardInsights.generatedAt ? new Date(ins.dashboardInsights.generatedAt).toLocaleDateString() : '—'}`);
        }
        if (ins.wellnessSnapshots?.length) {
          lines.push('');
          lines.push(`  Wellness Snapshots (${ins.wellnessSnapshots.length}):`);
          for (const ws of ins.wellnessSnapshots) {
            lines.push(`    • Score: ${ws.wellnessScore}  |  Mood: ${ws.moodAverage || '—'}  |  Engagement: ${ws.engagementLevel || '—'}  |  ${new Date(ws.periodStart).toLocaleDateString()} – ${new Date(ws.periodEnd).toLocaleDateString()}`);
          }
        }
        lines.push('');
      }

      // ── AI Memory ──
      if (exportPayload.memory) {
        const mem = exportPayload.memory;
        lines.push('───────────────────────────────────────────────────────────');
        lines.push('  AI MEMORY');
        lines.push('───────────────────────────────────────────────────────────');
        lines.push(`  Topics             : ${mem.topics || '—'}`);
        lines.push(`  Emotional Patterns : ${mem.emotionalPatterns || '—'}`);
        lines.push(`  Important Moments  : ${mem.importantMoments || '—'}`);
        lines.push(`  Conversation Style : ${mem.conversationMetrics || '—'}`);
        lines.push(`  Last Updated       : ${mem.updatedAt ? new Date(mem.updatedAt).toLocaleDateString() : '—'}`);
        lines.push('');
      }

      // ── Content & Plan Activity ──
      if (exportPayload.contentActivity) {
        const ca = exportPayload.contentActivity;
        if (ca.contentEngagements?.length) {
          lines.push('───────────────────────────────────────────────────────────');
          lines.push(`  CONTENT ENGAGEMENTS (${ca.contentEngagements.length} records)`);
          lines.push('───────────────────────────────────────────────────────────');
          for (const ce of ca.contentEngagements) {
            const title = ce.content?.title || ce.contentId;
            lines.push(`  • ${title} (${ce.content?.type || '—'})  —  Rating: ${ce.rating ?? '—'}/5  |  Time: ${ce.timeSpent ? Math.round(ce.timeSpent / 60) + ' min' : '—'}  |  Effectiveness: ${ce.effectiveness ?? '—'}/10  |  Completed: ${ce.completed ? 'Yes' : 'No'}`);
            if (ce.moodBefore || ce.moodAfter) lines.push(`    Mood: ${ce.moodBefore || '—'} → ${ce.moodAfter || '—'}`);
          }
          lines.push('');
        }
        if (ca.planModules?.length) {
          lines.push('───────────────────────────────────────────────────────────');
          lines.push(`  PLAN MODULES (${ca.planModules.length} modules)`);
          lines.push('───────────────────────────────────────────────────────────');
          for (const pm of ca.planModules) {
            lines.push(`  • ${pm.module?.title || '—'} (${pm.module?.type || '—'}, ${pm.module?.difficulty || '—'})  —  Progress: ${pm.progress}%  |  Completed: ${pm.completed ? 'Yes' : 'No'}${pm.completedAt ? '  |  ' + new Date(pm.completedAt).toLocaleDateString() : ''}`);
            if (pm.notes) lines.push(`    Notes: ${pm.notes}`);
          }
          lines.push('');
        }
      }

      // ── Safety Plan ──
      if (exportPayload.safetyPlan) {
        const sp = exportPayload.safetyPlan;
        lines.push('───────────────────────────────────────────────────────────');
        lines.push('  SAFETY PLAN');
        lines.push('───────────────────────────────────────────────────────────');
        lines.push(`  Warning Signs      : ${sp.warningSignsJson}`);
        lines.push(`  Coping Strategies  : ${sp.copingStrategiesJson}`);
        lines.push(`  Support Contacts   : ${sp.contactsJson}`);
        lines.push(`  Therapist          : ${sp.therapistName || '—'} ${sp.therapistPhone || ''}`);
        lines.push(`  Psychiatrist       : ${sp.psychiatristName || '—'} ${sp.psychiatristPhone || ''}`);
        lines.push(`  Emergency Room     : ${sp.emergencyRoom || '—'}`);
        lines.push(`  Crisis Line        : ${sp.crisisLine || '988'}`);
        lines.push(`  Safe Environment   : ${sp.safeEnvironmentJson}`);
        lines.push(`  Reasons to Live    : ${sp.reasonsToLiveJson}`);
        lines.push('');
      }

      // ── Support Tickets ──
      if (exportPayload.supportTickets?.length) {
        lines.push('───────────────────────────────────────────────────────────');
        lines.push(`  SUPPORT TICKETS (${exportPayload.supportTickets.length} tickets)`);
        lines.push('───────────────────────────────────────────────────────────');
        for (const t of exportPayload.supportTickets) {
          lines.push(`  • [${t.status}] ${t.subject}  —  ${t.category} / ${t.priority}  |  ${new Date(t.createdAt).toLocaleDateString()}`);
          lines.push(`    Message: ${t.message.substring(0, 200)}${t.message.length > 200 ? '…' : ''}`);
          if (t.response) lines.push(`    Response: ${t.response.substring(0, 200)}${t.response.length > 200 ? '…' : ''}`);
        }
        lines.push('');
      }

      // ── Sessions ──
      if (exportPayload.sessions) {
        const sess = exportPayload.sessions;
        if (sess.assessmentSessions?.length) {
          lines.push('───────────────────────────────────────────────────────────');
          lines.push(`  ASSESSMENT SESSIONS (${sess.assessmentSessions.length} sessions)`);
          lines.push('───────────────────────────────────────────────────────────');
          for (const s of sess.assessmentSessions) {
            lines.push(`  • ${new Date(s.startedAt).toLocaleDateString()}  —  Status: ${s.status}  |  Types: ${JSON.stringify(s.selectedTypes)}${s.completedAt ? '  |  Completed: ' + new Date(s.completedAt).toLocaleDateString() : ''}`);
          }
          lines.push('');
        }
        if (sess.userSessions?.length) {
          lines.push('───────────────────────────────────────────────────────────');
          lines.push(`  APP USAGE SESSIONS (${sess.userSessions.length} sessions)`);
          lines.push('───────────────────────────────────────────────────────────');
          for (const s of sess.userSessions) {
            lines.push(`  • ${new Date(s.startedAt).toLocaleDateString()}  —  Duration: ${s.duration ? Math.round(s.duration / 60) + ' min' : '—'}  |  Pages: ${s.pagesViewed}  |  Actions: ${s.actionsPerformed}  |  Device: ${s.deviceType || '—'}`);
          }
          lines.push('');
        }
      }

      // ── Chatbot Conversations ──
      if (exportPayload.chatbotConversations?.length) {
        lines.push('───────────────────────────────────────────────────────────');
        lines.push(`  CHATBOT CONVERSATIONS (${exportPayload.chatbotConversations.length} threads)`);
        lines.push('───────────────────────────────────────────────────────────');
        for (const cc of exportPayload.chatbotConversations) {
          lines.push(`  ┌─ ${cc.summary || 'No summary'} (${new Date(cc.startedAt).toLocaleDateString()})`);
          lines.push(`  │  Emotional State: ${cc.emotionalState || '—'}  |  Urgency: ${cc.urgencyLevel || '—'}`);
          lines.push(`  │  Topics: ${cc.keyTopics || '[]'}`);
          lines.push('  └─');
          lines.push('');
        }
      }

      // ── Bookings & Crisis Events ──
      if (exportPayload.bookingsCrisis) {
        const bc = exportPayload.bookingsCrisis;
        if (bc.therapistBookings?.length) {
          lines.push('───────────────────────────────────────────────────────────');
          lines.push(`  THERAPIST BOOKINGS (${bc.therapistBookings.length} bookings)`);
          lines.push('───────────────────────────────────────────────────────────');
          for (const b of bc.therapistBookings) {
            lines.push(`  • ${b.therapist?.name || '—'} (${b.therapist?.credential || '—'})  —  ${b.status}  |  ${b.preferredDate ? new Date(b.preferredDate).toLocaleDateString() : '—'} ${b.preferredTime || ''}`);
            if (b.message) lines.push(`    Message: ${b.message.substring(0, 200)}`);
          }
          lines.push('');
        }
        if (bc.crisisEvents?.length) {
          lines.push('───────────────────────────────────────────────────────────');
          lines.push(`  CRISIS EVENTS (${bc.crisisEvents.length} events)`);
          lines.push('───────────────────────────────────────────────────────────');
          for (const ce of bc.crisisEvents) {
            lines.push(`  • ${new Date(ce.detectedAt).toLocaleDateString()}  —  Level: ${ce.crisisLevel}  |  Confidence: ${(ce.confidence * 100).toFixed(0)}%  |  Resolved: ${ce.resolved ? 'Yes' : 'No'}`);
          }
          lines.push('');
        }
      }

      lines.push('═══════════════════════════════════════════════════════════');
      lines.push('  End of export — ManaSarathi © ' + new Date().getFullYear());
      lines.push('═══════════════════════════════════════════════════════════');

      const textContent = lines.join('\n');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="ManaSarathi-export-${dateStr}.txt"`);
      return res.send(textContent);
    }

    // ── PDF format ──
    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="ManaSarathi-export-${dateStr}.pdf"`);

      const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
      doc.pipe(res);

      // ── Design system ──
      const C = {
        primary: '#4f46e5', primaryLight: '#eef2ff', primaryDark: '#3730a3',
        heading: '#1e293b', text: '#334155', muted: '#94a3b8',
        border: '#e2e8f0', card: '#f8fafc', accent: '#10b981',
        white: '#ffffff', userBubble: '#eff6ff', botBubble: '#f0fdf4',
        warn: '#f59e0b', danger: '#ef4444',
      };
      const PAGE_W = 495; // 595 - 2*50 margins
      const LEFT = 50;
      const RIGHT = 545;

      // ── JSON parser ──
      const safeParseJSON = (val: any): any => {
        if (!val || val === '—') return null;
        if (typeof val === 'object') return val;
        try { return JSON.parse(val); } catch { return null; }
      };
      const jsonToList = (val: any): string[] => {
        const parsed = safeParseJSON(val);
        if (!parsed) return [];
        if (Array.isArray(parsed)) return parsed.map((v: any) => typeof v === 'object' ? JSON.stringify(v) : String(v));
        if (typeof parsed === 'object') return Object.entries(parsed).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
        return [String(parsed)];
      };

      // ── Page-overflow guard ──
      const ensureSpace = (needed: number) => {
        if (doc.y + needed > 760) doc.addPage();
      };

      // ── Section header ──
      const addSectionHeader = (title: string) => {
        ensureSpace(50);
        doc.moveDown(0.8);
        const y = doc.y;
        // Accent left bar
        doc.rect(LEFT, y, 4, 26).fill(C.primary);
        // Light background band
        doc.rect(LEFT + 4, y, PAGE_W - 4, 26).fill(C.primaryLight);
        // Title text
        doc.fillColor(C.primaryDark).fontSize(12).font('Helvetica-Bold')
          .text(title, LEFT + 14, y + 7, { width: PAGE_W - 24 });
        doc.y = y + 32;
        doc.fillColor(C.text).font('Helvetica').fontSize(10);
      };

      // ── Sub-header ──
      const addSubHeader = (title: string) => {
        ensureSpace(28);
        doc.moveDown(0.4);
        doc.font('Helvetica-Bold').fontSize(10).fillColor(C.heading).text(title);
        doc.moveTo(LEFT, doc.y + 2).lineTo(LEFT + 200, doc.y + 2).lineWidth(0.5).stroke(C.border);
        doc.moveDown(0.3);
        doc.font('Helvetica').fontSize(9).fillColor(C.text);
      };

      // ── Key-value row with proper column alignment ──
      const addRow = (label: string, value: string, indent = 0) => {
        ensureSpace(16);
        const x = LEFT + 10 + indent;
        doc.font('Helvetica-Bold').fontSize(9).fillColor(C.muted).text(label, x, doc.y, { width: 130, continued: false });
        const labelBottom = doc.y;
        doc.font('Helvetica').fontSize(9).fillColor(C.text)
          .text(value || '—', x + 135, labelBottom - doc.currentLineHeight(), { width: PAGE_W - 155 - indent });
        // Ensure y is at the bottom of whichever was taller
        doc.y = Math.max(doc.y, labelBottom);
      };

      // ── Card wrapper ──
      let _cardY = 0;
      const startCard = () => {
        ensureSpace(40);
        _cardY = doc.y;
        doc.y = _cardY + 8;
      };
      const endCard = () => {
        const bottom = doc.y + 4;
        doc.save();
        doc.roundedRect(LEFT + 6, _cardY, PAGE_W - 12, bottom - _cardY, 4).lineWidth(0.5).stroke(C.border);
        doc.restore();
        doc.y = bottom + 6;
      };

      // ── Bullet list from JSON ──
      const addBulletList = (items: string[], indent = 10) => {
        for (const item of items.slice(0, 20)) {
          ensureSpace(14);
          doc.font('Helvetica').fontSize(9).fillColor(C.text)
            .text(`•  ${item}`, LEFT + indent, doc.y, { width: PAGE_W - indent - 10 });
        }
        if (items.length > 20) {
          doc.fontSize(8).fillColor(C.muted).text(`  … and ${items.length - 20} more items`);
        }
      };

      // ── Wrapped paragraph text ──
      const addParagraph = (text: string, maxLen = 800) => {
        ensureSpace(30);
        const trimmed = text.length > maxLen ? text.substring(0, maxLen) + '…' : text;
        doc.font('Helvetica').fontSize(9).fillColor(C.text)
          .text(trimmed, LEFT + 10, doc.y, { width: PAGE_W - 20, lineGap: 2 });
        doc.moveDown(0.2);
      };

      // ════════════════════════════════════════════════════════
      //  COVER / HEADER
      // ════════════════════════════════════════════════════════
      doc.rect(0, 0, 595, 120).fill(C.primary);
      doc.fillColor(C.white).fontSize(28).font('Helvetica-Bold')
        .text('ManaSarathi', LEFT, 30, { align: 'center' });
      doc.fontSize(13).font('Helvetica')
        .text('Personal Data Export', { align: 'center' });
      doc.moveDown(0.4);
      doc.fontSize(9).fillColor('#c7d2fe')
        .text(`Generated ${new Date().toLocaleString()}  •  ${requestedSections.length} sections`, { align: 'center' });

      doc.y = 135;
      doc.fillColor(C.text).font('Helvetica').fontSize(10);

      // ════════════════════════════════════════════════════════
      //  PROFILE
      // ════════════════════════════════════════════════════════
      if (exportPayload.profile) {
        const p = exportPayload.profile;
        addSectionHeader('PROFILE');
        startCard();
        addRow('Name', `${p.firstName || ''} ${p.lastName || ''} (${p.name || ''})`);
        addRow('Email', p.email);
        addRow('Approach', p.approach || 'Not set');
        addRow('Birthday', p.birthday ? new Date(p.birthday).toLocaleDateString() : 'Not set');
        addRow('Gender', p.gender || 'Not set');
        addRow('Region', p.region || 'Not set');
        addRow('Language', p.language || 'Not set');
        addRow('Emergency Contact', `${p.emergencyContact || 'None'} ${p.emergencyPhone ? '(' + p.emergencyPhone + ')' : ''}`);
        addRow('Data Consent', p.dataConsent ? 'Yes' : 'No');
        addRow('Clinician Sharing', p.clinicianSharing ? 'Yes' : 'No');
        addRow('Member Since', new Date(p.createdAt).toLocaleDateString());
        endCard();
      }

      // ════════════════════════════════════════════════════════
      //  ASSESSMENTS
      // ════════════════════════════════════════════════════════
      if (exportPayload.assessments?.length) {
        addSectionHeader(`ASSESSMENTS  (${exportPayload.assessments.length})`);
        for (const a of exportPayload.assessments) {
          ensureSpace(30);
          startCard();
          doc.font('Helvetica-Bold').fontSize(10).fillColor(C.heading)
            .text(a.assessmentType.toUpperCase(), LEFT + 14, doc.y);
          doc.font('Helvetica').fontSize(9).fillColor(C.text);
          addRow('Score', String(a.score), 4);
          addRow('Date', new Date(a.completedAt).toLocaleDateString(), 4);
          endCard();
        }
      }

      // ════════════════════════════════════════════════════════
      //  MOOD ENTRIES
      // ════════════════════════════════════════════════════════
      if (exportPayload.moodEntries?.length) {
        addSectionHeader(`MOOD ENTRIES  (${exportPayload.moodEntries.length})`);
        for (const m of exportPayload.moodEntries) {
          ensureSpace(16);
          doc.font('Helvetica-Bold').fontSize(9).fillColor(C.muted)
            .text(new Date(m.createdAt).toLocaleDateString(), LEFT + 10, doc.y, { width: 80, continued: false });
          const rowY = doc.y - doc.currentLineHeight();
          doc.font('Helvetica').fontSize(9).fillColor(C.text)
            .text(`${m.mood}${m.notes ? '  —  ' + m.notes : ''}`, LEFT + 95, rowY, { width: PAGE_W - 105 });
          doc.y = Math.max(doc.y, rowY + doc.currentLineHeight());
        }
      }

      // ════════════════════════════════════════════════════════
      //  CONVERSATIONS
      // ════════════════════════════════════════════════════════
      if (exportPayload.conversations?.length) {
        addSectionHeader(`CONVERSATIONS  (${exportPayload.conversations.length})`);
        for (const c of exportPayload.conversations) {
          ensureSpace(60);
          // Conversation title bar
          const titleY = doc.y;
          doc.rect(LEFT + 6, titleY, PAGE_W - 12, 22).fill(C.card);
          doc.font('Helvetica-Bold').fontSize(10).fillColor(C.heading)
            .text(c.title || 'Untitled', LEFT + 14, titleY + 5, { width: 320, continued: false });
          doc.font('Helvetica').fontSize(8).fillColor(C.muted)
            .text(`${new Date(c.createdAt).toLocaleDateString()}  •  ${(c.messages || []).length} messages`, RIGHT - 180, titleY + 7, { width: 170, align: 'right' });
          doc.y = titleY + 28;

          // Messages
          for (const msg of (c.messages || []).slice(0, 50)) {
            ensureSpace(24);
            const isUser = msg.type === 'user';
            const bubbleColor = isUser ? C.userBubble : C.botBubble;
            const sender = isUser ? 'You' : 'ManaSarathi';
            const snippet = msg.content.substring(0, 400) + (msg.content.length > 400 ? '…' : '');
            const indent = isUser ? 30 : 10;

            // Bubble background
            const msgY = doc.y;
            const textW = PAGE_W - 50 - indent;
            const textH = doc.heightOfString(snippet, { width: textW }) + 8;
            doc.roundedRect(LEFT + indent, msgY, PAGE_W - indent - 16, textH + 16, 6).fill(bubbleColor);

            doc.font('Helvetica-Bold').fontSize(8).fillColor(isUser ? C.primary : C.accent)
              .text(sender, LEFT + indent + 8, msgY + 4, { width: textW });
            doc.font('Helvetica').fontSize(8.5).fillColor(C.text)
              .text(snippet, LEFT + indent + 8, doc.y, { width: textW, lineGap: 1.5 });
            doc.y = msgY + textH + 20;
          }
          if ((c.messages || []).length > 50) {
            doc.fontSize(8).fillColor(C.muted)
              .text(`… and ${(c.messages || []).length - 50} more messages`, LEFT + 14, doc.y);
          }
          doc.moveDown(0.5);
          doc.moveTo(LEFT + 20, doc.y).lineTo(RIGHT - 20, doc.y).lineWidth(0.3).stroke(C.border);
          doc.moveDown(0.3);
        }
      }

      // ════════════════════════════════════════════════════════
      //  GOALS
      // ════════════════════════════════════════════════════════
      if (exportPayload.goals?.length) {
        addSectionHeader(`WELLBEING GOALS  (${exportPayload.goals.length})`);
        for (const g of exportPayload.goals) {
          ensureSpace(40);
          startCard();
          doc.font('Helvetica-Bold').fontSize(10).fillColor(C.heading).text(g.title, LEFT + 14, doc.y);
          // Progress bar
          const barY = doc.y + 2;
          doc.rect(LEFT + 14, barY, 200, 8).lineWidth(0.5).stroke(C.border);
          doc.rect(LEFT + 14, barY, Math.max(2, (g.progress / 100) * 200), 8).fill(g.progress >= 100 ? C.accent : C.primary);
          doc.font('Helvetica').fontSize(8).fillColor(C.muted)
            .text(`${g.progress}%`, LEFT + 220, barY, { width: 40 });
          doc.y = barY + 14;
          addRow('Type', g.goalType, 4);
          addRow('Status', g.status === 'completed' ? 'Completed' : g.status === 'paused' ? 'Paused' : 'Active', 4);
          if (g.description) {
            doc.font('Helvetica').fontSize(8).fillColor(C.muted).text(g.description, LEFT + 14, doc.y, { width: PAGE_W - 28 });
          }
          endCard();
        }
      }

      // ════════════════════════════════════════════════════════
      //  PROGRESS TRACKING
      // ════════════════════════════════════════════════════════
      if (exportPayload.progress?.length) {
        addSectionHeader(`PROGRESS TRACKING  (${exportPayload.progress.length})`);
        // Table header
        ensureSpace(20);
        const colX = [LEFT + 10, LEFT + 100, LEFT + 200, LEFT + 270];
        doc.font('Helvetica-Bold').fontSize(8).fillColor(C.muted);
        doc.text('DATE', colX[0], doc.y);
        doc.text('METRIC', colX[1], doc.y - doc.currentLineHeight());
        doc.text('VALUE', colX[2], doc.y - doc.currentLineHeight());
        doc.text('NOTES', colX[3], doc.y - doc.currentLineHeight());
        doc.moveTo(LEFT + 6, doc.y + 2).lineTo(RIGHT - 6, doc.y + 2).lineWidth(0.3).stroke(C.border);
        doc.moveDown(0.3);
        
        for (const p of exportPayload.progress) {
          ensureSpace(14);
          const rowY = doc.y;
          doc.font('Helvetica').fontSize(8.5).fillColor(C.text);
          doc.text(new Date(p.date).toLocaleDateString(), colX[0], rowY, { width: 85 });
          doc.text(p.metric, colX[1], rowY, { width: 95 });
          doc.text(String(p.value), colX[2], rowY, { width: 65 });
          doc.text(p.notes || '—', colX[3], rowY, { width: RIGHT - colX[3] - 10 });
          doc.y = Math.max(doc.y, rowY + 12);
        }
      }

      // ════════════════════════════════════════════════════════
      //  INSIGHTS & WELLNESS
      // ════════════════════════════════════════════════════════
      if (exportPayload.insights) {
        const ins = exportPayload.insights;
        addSectionHeader('INSIGHTS & WELLNESS');

        if (ins.assessmentInsight) {
          addSubHeader('Assessment Insights');
          startCard();
          addRow('Wellness Score', String(ins.assessmentInsight.wellnessScore), 4);
          addRow('Overall Trend', ins.assessmentInsight.overallTrend || '—', 4);
          addRow('Last Updated', ins.assessmentInsight.updatedAt ? new Date(ins.assessmentInsight.updatedAt).toLocaleDateString() : '—', 4);
          endCard();
          // AI Summary as paragraph
          if (ins.assessmentInsight.aiSummary) {
            doc.font('Helvetica-Bold').fontSize(8).fillColor(C.muted).text('AI Summary', LEFT + 10, doc.y);
            addParagraph(ins.assessmentInsight.aiSummary);
          }
        }

        if (ins.dashboardInsights) {
          addSubHeader('Dashboard Insights');
          startCard();
          addRow('Assessment Count', String(ins.dashboardInsights.assessmentCount), 4);
          addRow('Chat Count', String(ins.dashboardInsights.chatCount), 4);
          addRow('Generated', ins.dashboardInsights.generatedAt ? new Date(ins.dashboardInsights.generatedAt).toLocaleDateString() : '—', 4);
          endCard();
          if (ins.dashboardInsights.aiSummary) {
            doc.font('Helvetica-Bold').fontSize(8).fillColor(C.muted).text('AI Summary', LEFT + 10, doc.y);
            addParagraph(ins.dashboardInsights.aiSummary);
          }
        }

        if (ins.wellnessSnapshots?.length) {
          addSubHeader(`Wellness Snapshots (${ins.wellnessSnapshots.length})`);
          for (const ws of ins.wellnessSnapshots.slice(0, 10)) {
            ensureSpace(18);
            doc.font('Helvetica').fontSize(8.5).fillColor(C.text)
              .text(`Score: ${ws.wellnessScore}   Mood: ${ws.moodAverage || '—'}   Engagement: ${ws.engagementLevel || '—'}   Period: ${new Date(ws.periodStart).toLocaleDateString()} – ${new Date(ws.periodEnd).toLocaleDateString()}`, LEFT + 14, doc.y, { width: PAGE_W - 28 });
          }
        }
      }

      // ════════════════════════════════════════════════════════
      //  AI MEMORY
      // ════════════════════════════════════════════════════════
      if (exportPayload.memory) {
        const mem = exportPayload.memory;
        addSectionHeader('AI MEMORY');

        // Topics
        const topicsData = safeParseJSON(mem.topics);
        if (topicsData && Object.keys(topicsData).length > 0) {
          addSubHeader('Topics Discussed');
          const topicItems = jsonToList(mem.topics);
          addBulletList(topicItems, 14);
          doc.moveDown(0.3);
        }

        // Emotional Patterns
        const epData = safeParseJSON(mem.emotionalPatterns);
        if (epData) {
          addSubHeader('Emotional Patterns');
          startCard();
          if (epData.predominant) addRow('Predominant', epData.predominant, 4);
          if (epData.recentShift) addRow('Recent Shift', epData.recentShift, 4);
          // Any other keys
          for (const [k, v] of Object.entries(epData)) {
            if (!['predominant', 'recentShift'].includes(k)) {
              addRow(k.charAt(0).toUpperCase() + k.slice(1).replace(/([A-Z])/g, ' $1'), typeof v === 'object' ? JSON.stringify(v) : String(v), 4);
            }
          }
          endCard();
        }

        // Important Moments
        const moments = safeParseJSON(mem.importantMoments);
        if (moments && Array.isArray(moments) && moments.length > 0) {
          addSubHeader('Important Moments');
          addBulletList(moments.map((m: any) => typeof m === 'object' ? (m.description || m.content || JSON.stringify(m)) : String(m)), 14);
          doc.moveDown(0.3);
        }

        // Conversation Style
        const metrics = safeParseJSON(mem.conversationMetrics);
        if (metrics) {
          addSubHeader('Conversation Style');
          startCard();
          if (metrics.totalMessages != null) addRow('Total Messages', String(metrics.totalMessages), 4);
          if (metrics.avgMessageLength != null) addRow('Avg Message Length', `${metrics.avgMessageLength} chars`, 4);
          if (metrics.questionsAsked != null) addRow('Questions Asked', String(metrics.questionsAsked), 4);
          if (metrics.sentimentCounts) {
            const sc = metrics.sentimentCounts;
            addRow('Sentiment', `Positive: ${sc.positive || 0}  •  Neutral: ${sc.neutral || 0}  •  Negative: ${sc.negative || 0}`, 4);
          }
          endCard();
        }

        addRow('Last Updated', mem.updatedAt ? new Date(mem.updatedAt).toLocaleDateString() : '—');
      }

      // ════════════════════════════════════════════════════════
      //  CONTENT & PLAN ACTIVITY
      // ════════════════════════════════════════════════════════
      if (exportPayload.contentActivity) {
        const ca = exportPayload.contentActivity;
        if (ca.contentEngagements?.length) {
          addSectionHeader(`CONTENT ENGAGEMENTS  (${ca.contentEngagements.length})`);
          for (const ce of ca.contentEngagements) {
            ensureSpace(35);
            startCard();
            const title = ce.content?.title || ce.contentId;
            doc.font('Helvetica-Bold').fontSize(10).fillColor(C.heading)
              .text(title, LEFT + 14, doc.y, { continued: true });
            doc.font('Helvetica').fontSize(8).fillColor(C.muted)
              .text(`  ${ce.content?.type || ''}`, { continued: false });
            addRow('Rating', ce.rating != null ? `${ce.rating}/5` : '—', 4);
            addRow('Effectiveness', ce.effectiveness != null ? `${ce.effectiveness}/10` : '—', 4);
            addRow('Time Spent', ce.timeSpent ? `${Math.round(ce.timeSpent / 60)} min` : '—', 4);
            if (ce.moodBefore || ce.moodAfter) addRow('Mood Change', `${ce.moodBefore || '—'} → ${ce.moodAfter || '—'}`, 4);
            addRow('Completed', ce.completed ? 'Yes' : 'In Progress', 4);
            endCard();
          }
        }
        if (ca.planModules?.length) {
          addSectionHeader(`PLAN MODULES  (${ca.planModules.length})`);
          for (const pm of ca.planModules) {
            ensureSpace(35);
            startCard();
            doc.font('Helvetica-Bold').fontSize(10).fillColor(C.heading)
              .text(pm.module?.title || '—', LEFT + 14, doc.y);
            addRow('Type', pm.module?.type || '—', 4);
            addRow('Difficulty', pm.module?.difficulty || '—', 4);
            addRow('Progress', `${pm.progress}%`, 4);
            addRow('Status', pm.completed ? 'Completed' : 'In Progress', 4);
            if (pm.notes) addRow('Notes', pm.notes, 4);
            endCard();
          }
        }
      }

      // ════════════════════════════════════════════════════════
      //  SAFETY PLAN
      // ════════════════════════════════════════════════════════
      if (exportPayload.safetyPlan) {
        const sp = exportPayload.safetyPlan;
        addSectionHeader('SAFETY PLAN');

        const renderJsonList = (title: string, jsonStr: string) => {
          const items = jsonToList(jsonStr);
          if (items.length > 0) {
            addSubHeader(title);
            addBulletList(items, 14);
            doc.moveDown(0.2);
          }
        };

        renderJsonList('Warning Signs', sp.warningSignsJson);
        renderJsonList('Coping Strategies', sp.copingStrategiesJson);
        renderJsonList('Support Contacts', sp.contactsJson);

        addSubHeader('Professional Support');
        startCard();
        addRow('Therapist', `${sp.therapistName || '—'}${sp.therapistPhone ? '  (' + sp.therapistPhone + ')' : ''}`, 4);
        addRow('Psychiatrist', `${sp.psychiatristName || '—'}${sp.psychiatristPhone ? '  (' + sp.psychiatristPhone + ')' : ''}`, 4);
        addRow('Emergency Room', sp.emergencyRoom || '—', 4);
        addRow('Crisis Line', sp.crisisLine || '988', 4);
        endCard();

        renderJsonList('Safe Environment', sp.safeEnvironmentJson);
        renderJsonList('Reasons to Live', sp.reasonsToLiveJson);
      }

      // ════════════════════════════════════════════════════════
      //  SUPPORT TICKETS
      // ════════════════════════════════════════════════════════
      if (exportPayload.supportTickets?.length) {
        addSectionHeader(`SUPPORT TICKETS  (${exportPayload.supportTickets.length})`);
        for (const t of exportPayload.supportTickets) {
          ensureSpace(50);
          startCard();
          // Status badge color
          const statusColors: Record<string, string> = { OPEN: C.primary, IN_PROGRESS: C.warn, RESOLVED: C.accent, CLOSED: C.muted };
          doc.font('Helvetica-Bold').fontSize(10).fillColor(statusColors[t.status] || C.text)
            .text(`[${t.status}]`, LEFT + 14, doc.y, { continued: true });
          doc.fillColor(C.heading).text(`  ${t.subject}`, { continued: false });
          addRow('Category', `${t.category}  •  Priority: ${t.priority}`, 4);
          addRow('Date', new Date(t.createdAt).toLocaleDateString(), 4);
          doc.font('Helvetica').fontSize(8.5).fillColor(C.text)
            .text(t.message.substring(0, 400), LEFT + 14, doc.y, { width: PAGE_W - 28, lineGap: 1.5 });
          if (t.response) {
            doc.moveDown(0.2);
            doc.font('Helvetica-Bold').fontSize(8).fillColor(C.accent).text('Response:', LEFT + 14, doc.y);
            doc.font('Helvetica').fontSize(8.5).fillColor(C.text)
              .text(t.response.substring(0, 400), LEFT + 14, doc.y, { width: PAGE_W - 28, lineGap: 1.5 });
          }
          endCard();
        }
      }

      // ════════════════════════════════════════════════════════
      //  SESSIONS
      // ════════════════════════════════════════════════════════
      if (exportPayload.sessions) {
        const sess = exportPayload.sessions;
        if (sess.assessmentSessions?.length) {
          addSectionHeader(`ASSESSMENT SESSIONS  (${sess.assessmentSessions.length})`);
          for (const s of sess.assessmentSessions) {
            ensureSpace(20);
            const types = safeParseJSON(s.selectedTypes);
            const typeStr = Array.isArray(types) ? types.join(', ') : String(s.selectedTypes || '—');
            doc.font('Helvetica').fontSize(9).fillColor(C.text)
              .text(`${new Date(s.startedAt).toLocaleDateString()}   Status: ${s.status}   Types: ${typeStr}${s.completedAt ? '   Completed: ' + new Date(s.completedAt).toLocaleDateString() : ''}`, LEFT + 14, doc.y, { width: PAGE_W - 28 });
          }
        }
        if (sess.userSessions?.length) {
          addSectionHeader(`APP USAGE SESSIONS  (${sess.userSessions.length})`);
          // Table header
          ensureSpace(20);
          const cols = [LEFT + 10, LEFT + 95, LEFT + 175, LEFT + 240, LEFT + 310, LEFT + 380];
          doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.muted);
          const hY = doc.y;
          doc.text('DATE', cols[0], hY); doc.text('DURATION', cols[1], hY); doc.text('PAGES', cols[2], hY);
          doc.text('ACTIONS', cols[3], hY); doc.text('DEVICE', cols[4], hY);
          doc.y = hY + 10;
          doc.moveTo(LEFT + 6, doc.y).lineTo(RIGHT - 6, doc.y).lineWidth(0.3).stroke(C.border);
          doc.moveDown(0.2);

          for (const s of sess.userSessions.slice(0, 50)) {
            ensureSpace(14);
            const rY = doc.y;
            doc.font('Helvetica').fontSize(8).fillColor(C.text);
            doc.text(new Date(s.startedAt).toLocaleDateString(), cols[0], rY, { width: 80 });
            doc.text(s.duration ? `${Math.round(s.duration / 60)} min` : '—', cols[1], rY, { width: 75 });
            doc.text(String(s.pagesViewed), cols[2], rY, { width: 60 });
            doc.text(String(s.actionsPerformed), cols[3], rY, { width: 65 });
            doc.text(s.deviceType || '—', cols[4], rY, { width: 80 });
            doc.y = rY + 12;
          }
        }
      }

      // ════════════════════════════════════════════════════════
      //  CHATBOT CONVERSATIONS
      // ════════════════════════════════════════════════════════
      if (exportPayload.chatbotConversations?.length) {
        addSectionHeader(`CHATBOT CONVERSATIONS  (${exportPayload.chatbotConversations.length})`);
        for (const cc of exportPayload.chatbotConversations) {
          ensureSpace(45);
          startCard();
          doc.font('Helvetica-Bold').fontSize(10).fillColor(C.heading)
            .text(cc.summary || 'No summary', LEFT + 14, doc.y, { width: PAGE_W - 28 });
          addRow('Date', new Date(cc.startedAt).toLocaleDateString(), 4);
          addRow('Emotional State', cc.emotionalState || '—', 4);
          addRow('Urgency Level', cc.urgencyLevel || '—', 4);
          const topics = safeParseJSON(cc.keyTopics);
          addRow('Key Topics', Array.isArray(topics) ? topics.join(', ') : (cc.keyTopics || '—'), 4);
          endCard();
        }
      }

      // ════════════════════════════════════════════════════════
      //  BOOKINGS & CRISIS
      // ════════════════════════════════════════════════════════
      if (exportPayload.bookingsCrisis) {
        const bc = exportPayload.bookingsCrisis;
        if (bc.therapistBookings?.length) {
          addSectionHeader(`THERAPIST BOOKINGS  (${bc.therapistBookings.length})`);
          for (const b of bc.therapistBookings) {
            ensureSpace(35);
            startCard();
            doc.font('Helvetica-Bold').fontSize(10).fillColor(C.heading)
              .text(`${b.therapist?.name || '—'}`, LEFT + 14, doc.y, { continued: true });
            doc.font('Helvetica').fontSize(8).fillColor(C.muted)
              .text(`  ${b.therapist?.credential || ''}`, { continued: false });
            addRow('Status', b.status, 4);
            addRow('Preferred Date', b.preferredDate ? `${new Date(b.preferredDate).toLocaleDateString()} ${b.preferredTime || ''}` : '—', 4);
            if (b.message) addRow('Message', b.message, 4);
            endCard();
          }
        }
        if (bc.crisisEvents?.length) {
          addSectionHeader(`CRISIS EVENTS  (${bc.crisisEvents.length})`);
          for (const ce of bc.crisisEvents) {
            ensureSpace(30);
            const levelColors: Record<string, string> = { CRITICAL: C.danger, HIGH: '#f97316', MODERATE: C.warn, LOW: C.accent, NONE: C.muted };
            startCard();
            doc.font('Helvetica-Bold').fontSize(10).fillColor(levelColors[ce.crisisLevel] || C.text)
              .text(ce.crisisLevel, LEFT + 14, doc.y, { continued: true });
            doc.font('Helvetica').fontSize(9).fillColor(C.text)
              .text(`   ${new Date(ce.detectedAt).toLocaleDateString()}   Confidence: ${(ce.confidence * 100).toFixed(0)}%   ${ce.resolved ? 'Resolved' : 'Unresolved'}`, { continued: false });
            endCard();
          }
        }
      }

      // ════════════════════════════════════════════════════════
      //  FOOTER
      // ════════════════════════════════════════════════════════
      ensureSpace(50);
      doc.moveDown(1.5);
      doc.moveTo(LEFT, doc.y).lineTo(RIGHT, doc.y).lineWidth(0.5).stroke(C.border);
      doc.moveDown(0.5);
      doc.fontSize(8).fillColor(C.muted).font('Helvetica')
        .text(`ManaSarathi © ${new Date().getFullYear()}`, { align: 'center' });
      doc.text('This document contains personal data. Handle with care.', { align: 'center' });

      doc.end();
      return; // stream is piped
    }
  } catch (error) {
    console.error('Export data error:', error);
    res.status(500).json({ success: false, error: 'Failed to export data' });
  }
});

/**
 * POST /api/privacy/delete-account
 * Permanently deletes the user's account and all related data
 */
router.post('/delete-account', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const { confirmation } = req.body;
    if (confirmation !== 'DELETE') {
      return res.status(400).json({
        success: false,
        error: 'Please send { "confirmation": "DELETE" } to confirm account deletion',
      });
    }

    // Delete all related data in order (respecting foreign key constraints)
    // With onDelete: Cascade in the schema, deleting the user cascades to most relations.
    // But for safety, we'll explicitly clean up key tables first.
    await prisma.$transaction(async (tx) => {
      // Delete chat messages (belongs to conversation and user)
      await tx.chatMessage.deleteMany({ where: { userId } });

      // Delete conversation goals
      await tx.conversationGoal.deleteMany({ where: { userId } });

      // Delete conversation memory
      await tx.conversationMemory.deleteMany({ where: { userId } });

      // Delete conversations
      await tx.conversation.deleteMany({ where: { userId } });

      // Delete assessment insights
      await tx.assessmentInsight.deleteMany({ where: { userId } });

      // Delete assessment sessions (responses are stored as JSON in AssessmentResult, no separate table)
      await tx.assessmentSession.deleteMany({ where: { userId } });

      // Delete assessment results
      await tx.assessmentResult.deleteMany({ where: { userId } });

      // Delete mood entries
      await tx.moodEntry.deleteMany({ where: { userId } });

      // Delete progress tracking
      await tx.progressTracking.deleteMany({ where: { userId } });

      // Delete plan modules
      await tx.userPlanModule.deleteMany({ where: { userId } });

      // Delete content engagements
      await tx.contentEngagement.deleteMany({ where: { userId } });

      // Delete chatbot conversations (messages stored as JSON field, not separate table)
      await tx.chatbotConversation.deleteMany({ where: { userId } });

      // Delete dashboard insights
      await tx.dashboardInsights.deleteMany({ where: { userId } });

      // Delete support tickets
      await tx.supportTicket.deleteMany({ where: { userId } });

      // Delete safety plan
      await tx.safetyPlan.deleteMany({ where: { userId } });

      // Delete therapist bookings
      await tx.therapistBooking.deleteMany({ where: { userId } });

      // Delete analytics data
      await tx.crisisEvent.deleteMany({ where: { userId } });
      await tx.userSession.deleteMany({ where: { userId } });
      await tx.wellnessSnapshot.deleteMany({ where: { userId } });

      // Finally, delete the user
      await tx.user.delete({ where: { id: userId } });
    });

    res.json({
      success: true,
      data: { message: 'Account and all associated data have been permanently deleted' },
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete account' });
  }
});

export default router;
