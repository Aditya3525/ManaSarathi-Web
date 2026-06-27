/**
 * seed-test-users.ts
 * Creates 3 realistic demo users with ~35 days of activity:
 *   1. Priya Sharma   – 22yo college student, anxiety + burnout (Eastern approach)
 *   2. Rohan Mehra    – 35yo IT professional, work-stress + mild depression (Western approach)
 *   3. Ananya Iyer    – 45yo teacher, sleep issues + overthinking (Hybrid approach)
 *
 * Run: npx ts-node scripts/seed-test-users.ts
 */

import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Fix relative DB path
const databaseUrl = (process.env.DATABASE_URL || '').trim();
if (databaseUrl.startsWith('file:')) {
  const rawPath = databaseUrl.slice('file:'.length);
  if (rawPath.startsWith('./') || rawPath.startsWith('../')) {
    process.env.DATABASE_URL = `file:${path.resolve(__dirname, '..', rawPath).replace(/\\/g, '/')}`;
  }
}

const prisma = new PrismaClient();

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Return a Date that is `daysAgo` days before now, optionally offset by hours */
function daysBack(daysAgo: number, hoursOffset = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(d.getHours() - hoursOffset);
  return d;
}

function json(v: unknown): string {
  return JSON.stringify(v);
}

/** Pick a random element */
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Password for all test users
const TEST_PASSWORD = 'Test@1234';

// ─── User Definitions ────────────────────────────────────────────────────────

const USERS = [
  {
    email: 'priya.sharma.test@manasarathi.app',
    name: 'Priya Sharma',
    firstName: 'Priya',
    lastName: 'Sharma',
    gender: 'female',
    birthday: new Date('2003-08-14'), // 22 years old
    region: 'Maharashtra, India',
    approach: 'eastern',
    language: 'en',
    profile: 'College student, final year engineering. Struggles with exam anxiety and burnout. Recently started meditating.',
  },
  {
    email: 'rohan.mehra.test@manasarathi.app',
    name: 'Rohan Mehra',
    firstName: 'Rohan',
    lastName: 'Mehra',
    gender: 'male',
    birthday: new Date('1989-03-22'), // 35 years old
    region: 'Karnataka, India',
    approach: 'western',
    language: 'en',
    profile: 'Senior software developer. Dealing with chronic work stress and mild depressive episodes. Uses CBT-based strategies.',
  },
  {
    email: 'ananya.iyer.test@manasarathi.app',
    name: 'Ananya Iyer',
    firstName: 'Ananya',
    lastName: 'Iyer',
    gender: 'female',
    birthday: new Date('1979-11-05'), // 45 years old
    region: 'Tamil Nadu, India',
    approach: 'hybrid',
    language: 'en',
    profile: 'School teacher, head of department. Overthinks everything, poor sleep patterns. Interested in yoga and mindfulness.',
  },
];

// ─── Mood patterns per user ───────────────────────────────────────────────────

// Mood arcs over 35 days (index 0 = 35 days ago, index 34 = today)
// Priya: high anxiety early → gradual improvement
const PRIYA_MOODS = [
  { mood: 'Anxious', emotion: 'overwhelmed', intensity: 8, trigger: 'exam schedule released', notes: 'Cannot stop thinking about finals' },
  { mood: 'Struggling', emotion: 'nervous', intensity: 7, trigger: 'missed lecture', notes: 'Feeling behind on everything' },
  { mood: 'Anxious', emotion: 'worried', intensity: 8, notes: "Couldn't sleep last night again" },
  { mood: 'Okay', emotion: 'hopeful', intensity: 5, notes: 'Tried breathing exercise – helped a little' },
  { mood: 'Struggling', emotion: 'exhausted', intensity: 7, trigger: 'group project conflict', notes: 'Too much conflict in team' },
  { mood: 'Anxious', emotion: 'fearful', intensity: 8, notes: 'Presentation tomorrow, terrified' },
  { mood: 'Good', emotion: 'relieved', intensity: 6, notes: 'Presentation went okay!' },
  { mood: 'Okay', emotion: 'calm', intensity: 5, notes: 'Meditated for first time properly' },
  { mood: 'Okay', emotion: 'content', intensity: 5, notes: 'Steady day' },
  { mood: 'Anxious', emotion: 'worried', intensity: 7, trigger: 'internship rejection', notes: 'Got rejected from internship application' },
  { mood: 'Struggling', emotion: 'sad', intensity: 7, notes: 'Hard to get out of bed' },
  { mood: 'Okay', emotion: 'hopeful', intensity: 5, notes: 'Talked to friend, felt better' },
  { mood: 'Good', emotion: 'motivated', intensity: 6, notes: 'Applied to 3 more internships' },
  { mood: 'Good', emotion: 'content', intensity: 6, notes: 'Yoga session felt amazing' },
  { mood: 'Okay', emotion: 'calm', intensity: 5, notes: 'Steady, kept up morning routine' },
  { mood: 'Anxious', emotion: 'nervous', intensity: 6, trigger: 'mid-sem results', notes: 'Mid-sem marks released, worried about GPA' },
  { mood: 'Okay', emotion: 'accepting', intensity: 5, notes: 'Marks were fine actually' },
  { mood: 'Good', emotion: 'happy', intensity: 7, notes: 'Hung out with friends, laughter helps' },
  { mood: 'Good', emotion: 'energetic', intensity: 7, notes: 'Slept 8 hours! First time in weeks' },
  { mood: 'Okay', emotion: 'calm', intensity: 5, notes: 'Normal day, journaled before bed' },
  { mood: 'Good', emotion: 'grateful', intensity: 7, notes: 'Gratitude practice is growing on me' },
  { mood: 'Good', emotion: 'motivated', intensity: 7, notes: 'Started studying earlier today' },
  { mood: 'Okay', emotion: 'content', intensity: 6, notes: 'Weekend, rested' },
  { mood: 'Okay', emotion: 'calm', intensity: 5, notes: 'Morning walk helped' },
  { mood: 'Good', emotion: 'happy', intensity: 7, notes: 'Internship callback received!' },
  { mood: 'Great', emotion: 'excited', intensity: 9, notes: 'Interview scheduled for next week' },
  { mood: 'Okay', emotion: 'hopeful', intensity: 6, notes: 'Preparing for interview, cautious optimism' },
  { mood: 'Good', emotion: 'confident', intensity: 7, notes: 'Mock interview practice session done' },
  { mood: 'Good', emotion: 'content', intensity: 7, notes: 'Feeling steadier overall' },
  { mood: 'Great', emotion: 'joyful', intensity: 8, notes: 'Aced the interview!' },
  { mood: 'Great', emotion: 'proud', intensity: 8, notes: 'Got the internship offer!' },
  { mood: 'Good', emotion: 'grateful', intensity: 7, notes: 'Feeling so thankful today' },
  { mood: 'Good', emotion: 'motivated', intensity: 7, notes: 'Back to studying with new energy' },
  { mood: 'Good', emotion: 'happy', intensity: 7, notes: 'Good sleep, good study session' },
  { mood: 'Great', emotion: 'content', intensity: 8, notes: 'Best month in a while. Growth is real.' },
];

// Rohan: starts stressed/depressed, plateau mid-month, steady improvement
const ROHAN_MOODS = [
  { mood: 'Struggling', emotion: 'exhausted', intensity: 8, trigger: 'sprint deadline', notes: 'Three late nights in a row, can\'t keep this up' },
  { mood: 'Anxious', emotion: 'overwhelmed', intensity: 7, notes: 'Task list keeps growing' },
  { mood: 'Struggling', emotion: 'hopeless', intensity: 8, notes: 'What\'s the point, nobody notices the effort' },
  { mood: 'Okay', emotion: 'numb', intensity: 4, notes: 'Just going through motions' },
  { mood: 'Struggling', emotion: 'irritable', intensity: 7, trigger: 'heated code review', notes: 'Snapped at a colleague, feel terrible' },
  { mood: 'Okay', emotion: 'remorseful', intensity: 5, notes: 'Apologised to colleague, hard conversation' },
  { mood: 'Okay', emotion: 'calm', intensity: 5, notes: 'Took a walk after lunch, first time in months' },
  { mood: 'Struggling', emotion: 'anxious', intensity: 7, trigger: 'manager feedback', notes: 'Feedback session felt critical' },
  { mood: 'Okay', emotion: 'flat', intensity: 4, notes: 'No energy, Netflix evening' },
  { mood: 'Okay', emotion: 'hopeful', intensity: 5, notes: 'Started CBT worksheet, interesting' },
  { mood: 'Okay', emotion: 'calm', intensity: 5, notes: 'Breathing exercise during standup anxiety' },
  { mood: 'Okay', emotion: 'motivated', intensity: 6, notes: 'Finished a piece of tech debt, satisfying' },
  { mood: 'Good', emotion: 'content', intensity: 6, notes: 'Weekend hike, felt human again' },
  { mood: 'Good', emotion: 'energetic', intensity: 7, notes: 'Slept without phone in room' },
  { mood: 'Okay', emotion: 'calm', intensity: 5, notes: 'Difficult meeting but handled it' },
  { mood: 'Okay', emotion: 'tired', intensity: 5, notes: 'Long week but surviving' },
  { mood: 'Good', emotion: 'proud', intensity: 6, notes: 'Code shipped on time, team happy' },
  { mood: 'Good', emotion: 'happy', intensity: 7, notes: 'Date night, disconnected from work' },
  { mood: 'Good', emotion: 'content', intensity: 6, notes: 'Sunday morning run started' },
  { mood: 'Okay', emotion: 'calm', intensity: 6, notes: 'Monday not dreaded as much' },
  { mood: 'Good', emotion: 'motivated', intensity: 7, notes: 'Got compliment from senior in meeting' },
  { mood: 'Good', emotion: 'confident', intensity: 7, notes: 'Led retro meeting, went well' },
  { mood: 'Good', emotion: 'content', intensity: 7, notes: 'Evening walk habit is sticking' },
  { mood: 'Good', emotion: 'grateful', intensity: 7, notes: 'Friends invited for weekend, feels connected' },
  { mood: 'Good', emotion: 'happy', intensity: 7, notes: 'Good code review, constructive tone' },
  { mood: 'Good', emotion: 'energetic', intensity: 7, notes: 'Gym session resumed' },
  { mood: 'Good', emotion: 'content', intensity: 7, notes: 'Finished a side project chapter' },
  { mood: 'Great', emotion: 'excited', intensity: 8, notes: 'Promotion conversation initiated by manager' },
  { mood: 'Good', emotion: 'hopeful', intensity: 7, notes: 'Future looks more manageable' },
  { mood: 'Good', emotion: 'motivated', intensity: 7, notes: 'Setting Q3 personal goals' },
  { mood: 'Great', emotion: 'proud', intensity: 8, notes: 'Promotion confirmed!' },
  { mood: 'Great', emotion: 'joyful', intensity: 9, notes: 'Celebrated with team' },
  { mood: 'Good', emotion: 'grateful', intensity: 8, notes: 'Things actually getting better' },
  { mood: 'Good', emotion: 'content', intensity: 7, notes: 'Steady rhythm now' },
  { mood: 'Great', emotion: 'happy', intensity: 8, notes: 'Starting new role next month, excited' },
];

// Ananya: chronic low-grade distress, slow improvements via yoga/sleep hygiene
const ANANYA_MOODS = [
  { mood: 'Okay', emotion: 'worried', intensity: 6, trigger: 'board exams prep pressure', notes: 'Students not performing, my fault?' },
  { mood: 'Anxious', emotion: 'overwhelmed', intensity: 7, notes: 'Three meetings + parent complaints today' },
  { mood: 'Okay', emotion: 'tired', intensity: 6, notes: 'Barely slept. Woke at 3am worrying' },
  { mood: 'Struggling', emotion: 'exhausted', intensity: 7, notes: 'Physically and mentally drained' },
  { mood: 'Okay', emotion: 'calm', intensity: 5, notes: 'Yoga in the morning helped' },
  { mood: 'Okay', emotion: 'content', intensity: 5, notes: 'Good day in class, students were engaged' },
  { mood: 'Anxious', emotion: 'worried', intensity: 6, trigger: 'school inspection next week', notes: 'Worried about the inspection' },
  { mood: 'Okay', emotion: 'stressed', intensity: 6, notes: 'Preparing lesson plans obsessively' },
  { mood: 'Okay', emotion: 'tired', intensity: 6, notes: 'Inspection prep exhausting' },
  { mood: 'Good', emotion: 'relieved', intensity: 7, notes: 'Inspection done, went well' },
  { mood: 'Good', emotion: 'content', intensity: 6, notes: 'Long weekend – first real break in months' },
  { mood: 'Good', emotion: 'happy', intensity: 7, notes: 'Spent time with family, felt like myself' },
  { mood: 'Okay', emotion: 'calm', intensity: 6, notes: 'Back to work but less anxious' },
  { mood: 'Okay', emotion: 'content', intensity: 6, notes: 'Yoga 3 days in a row now' },
  { mood: 'Okay', emotion: 'tired', intensity: 5, notes: 'Still waking at 3am but shorter now' },
  { mood: 'Okay', emotion: 'hopeful', intensity: 6, notes: 'Body scan meditation before bed helped' },
  { mood: 'Good', emotion: 'content', intensity: 6, notes: 'Slept 6.5 hours uninterrupted! Progress' },
  { mood: 'Good', emotion: 'motivated', intensity: 6, notes: 'Students scored well in class test' },
  { mood: 'Okay', emotion: 'calm', intensity: 6, notes: 'Used grounding when stress rose in meeting' },
  { mood: 'Good', emotion: 'happy', intensity: 7, notes: 'Cooked elaborate meal for family – therapeutic' },
  { mood: 'Good', emotion: 'content', intensity: 7, notes: 'Sleep improving steadily' },
  { mood: 'Good', emotion: 'grateful', intensity: 7, notes: 'Gratitude journal before bed becoming habit' },
  { mood: 'Good', emotion: 'motivated', intensity: 7, notes: 'New semester plan feels manageable' },
  { mood: 'Good', emotion: 'content', intensity: 7, notes: 'Maintained yoga this week' },
  { mood: 'Good', emotion: 'calm', intensity: 7, notes: 'Difficult student handled with patience' },
  { mood: 'Good', emotion: 'happy', intensity: 7, notes: 'Weekend retreat at ashram – recharging' },
  { mood: 'Great', emotion: 'peaceful', intensity: 8, notes: 'Best sleep in months at ashram' },
  { mood: 'Good', emotion: 'energetic', intensity: 7, notes: 'Back home, energy sustained' },
  { mood: 'Good', emotion: 'confident', intensity: 7, notes: 'Taking on department head responsibility with less fear' },
  { mood: 'Good', emotion: 'content', intensity: 7, notes: 'Managed two crises today calmly' },
  { mood: 'Great', emotion: 'proud', intensity: 8, notes: 'Got commendation from principal' },
  { mood: 'Good', emotion: 'grateful', intensity: 7, notes: 'So grateful for this journey' },
  { mood: 'Good', emotion: 'happy', intensity: 7, notes: 'Students performed at cultural fest' },
  { mood: 'Good', emotion: 'content', intensity: 7, notes: 'Steady and grounded today' },
  { mood: 'Great', emotion: 'peaceful', intensity: 8, notes: 'Month of real change. Less overthinking, more presence.' },
];

// ─── Assessment data ──────────────────────────────────────────────────────────

function priyaAssessments(userId: string) {
  return [
    // Week 1 – high anxiety baseline
    { userId, assessmentType: 'anxiety', score: 78, normalizedScore: 78, rawScore: 16, maxScore: 20,
      responses: json([{q:'nervous',a:4},{q:'worrying',a:4},{q:'relaxing',a:3},{q:'restless',a:3},{q:'dread',a:2}]),
      categoryScores: {physical:75,cognitive:80,emotional:79}, completedAt: daysBack(33) },
    { userId, assessmentType: 'stress', score: 72, normalizedScore: 72, rawScore: 14, maxScore: 20,
      responses: json([{q:'overwhelmed',a:3},{q:'concentrating',a:4},{q:'irritable',a:3},{q:'sleep_issues',a:2},{q:'tension',a:2}]),
      categoryScores: {academic:80,social:65,health:71}, completedAt: daysBack(33) },
    // Week 3 – mild improvement
    { userId, assessmentType: 'anxiety', score: 65, normalizedScore: 65, rawScore: 13, maxScore: 20,
      responses: json([{q:'nervous',a:3},{q:'worrying',a:3},{q:'relaxing',a:3},{q:'restless',a:2},{q:'dread',a:2}]),
      categoryScores: {physical:62,cognitive:68,emotional:65}, completedAt: daysBack(16) },
    { userId, assessmentType: 'overthinking', score: 68, normalizedScore: 68, rawScore: 14, maxScore: 20,
      responses: json([{q:'ruminate',a:3},{q:'cant_stop',a:4},{q:'replay',a:3},{q:'what_if',a:4}]),
      categoryScores: {rumination:72,intrusive_thoughts:65,decision_anxiety:67}, completedAt: daysBack(16) },
    // Final week – clear improvement
    { userId, assessmentType: 'anxiety', score: 45, normalizedScore: 45, rawScore: 9, maxScore: 20,
      responses: json([{q:'nervous',a:2},{q:'worrying',a:2},{q:'relaxing',a:2},{q:'restless',a:2},{q:'dread',a:1}]),
      categoryScores: {physical:42,cognitive:48,emotional:45}, completedAt: daysBack(2) },
    { userId, assessmentType: 'emotionalIntelligence', score: 74, normalizedScore: 74, rawScore: 15, maxScore: 20,
      responses: json([{q:'awareness',a:4},{q:'empathy',a:4},{q:'regulation',a:3},{q:'social',a:4}]),
      categoryScores: {selfAwareness:78,empathy:75,regulation:68,social:75}, completedAt: daysBack(2) },
  ];
}

function rohanAssessments(userId: string) {
  return [
    // Baseline – high stress + mild depression markers
    { userId, assessmentType: 'stress', score: 82, normalizedScore: 82, rawScore: 16, maxScore: 20,
      responses: json([{q:'overwhelmed',a:4},{q:'concentrating',a:4},{q:'irritable',a:4},{q:'sleep_issues',a:2},{q:'tension',a:2}]),
      categoryScores: {work:90,personal:75,health:81}, completedAt: daysBack(34) },
    { userId, assessmentType: 'anxiety', score: 60, normalizedScore: 60, rawScore: 12, maxScore: 20,
      responses: json([{q:'nervous',a:3},{q:'worrying',a:3},{q:'relaxing',a:3},{q:'restless',a:2},{q:'dread',a:1}]),
      categoryScores: {physical:58,cognitive:62,emotional:60}, completedAt: daysBack(34) },
    // Mid-month
    { userId, assessmentType: 'stress', score: 65, normalizedScore: 65, rawScore: 13, maxScore: 20,
      responses: json([{q:'overwhelmed',a:3},{q:'concentrating',a:3},{q:'irritable',a:3},{q:'sleep_issues',a:2},{q:'tension',a:2}]),
      categoryScores: {work:70,personal:60,health:65}, completedAt: daysBack(18) },
    { userId, assessmentType: 'overthinking', score: 55, normalizedScore: 55, rawScore: 11, maxScore: 20,
      responses: json([{q:'ruminate',a:3},{q:'cant_stop',a:3},{q:'replay',a:2},{q:'what_if',a:3}]),
      categoryScores: {rumination:58,intrusive_thoughts:52,decision_anxiety:55}, completedAt: daysBack(18) },
    // End of month
    { userId, assessmentType: 'stress', score: 42, normalizedScore: 42, rawScore: 8, maxScore: 20,
      responses: json([{q:'overwhelmed',a:2},{q:'concentrating',a:2},{q:'irritable',a:2},{q:'sleep_issues',a:1},{q:'tension',a:1}]),
      categoryScores: {work:45,personal:40,health:41}, completedAt: daysBack(1) },
    { userId, assessmentType: 'emotionalIntelligence', score: 70, normalizedScore: 70, rawScore: 14, maxScore: 20,
      responses: json([{q:'awareness',a:3},{q:'empathy',a:4},{q:'regulation',a:3},{q:'social',a:4}]),
      categoryScores: {selfAwareness:68,empathy:73,regulation:68,social:71}, completedAt: daysBack(1) },
  ];
}

function ananyaAssessments(userId: string) {
  return [
    // Baseline
    { userId, assessmentType: 'overthinking', score: 75, normalizedScore: 75, rawScore: 15, maxScore: 20,
      responses: json([{q:'ruminate',a:4},{q:'cant_stop',a:4},{q:'replay',a:3},{q:'what_if',a:4}]),
      categoryScores: {rumination:80,intrusive_thoughts:70,decision_anxiety:75}, completedAt: daysBack(32) },
    { userId, assessmentType: 'stress', score: 70, normalizedScore: 70, rawScore: 14, maxScore: 20,
      responses: json([{q:'overwhelmed',a:3},{q:'concentrating',a:3},{q:'irritable',a:3},{q:'sleep_issues',a:4},{q:'tension',a:1}]),
      categoryScores: {work:75,personal:65,health:70}, completedAt: daysBack(32) },
    // Mid
    { userId, assessmentType: 'overthinking', score: 58, normalizedScore: 58, rawScore: 12, maxScore: 20,
      responses: json([{q:'ruminate',a:3},{q:'cant_stop',a:3},{q:'replay',a:3},{q:'what_if',a:3}]),
      categoryScores: {rumination:62,intrusive_thoughts:55,decision_anxiety:57}, completedAt: daysBack(17) },
    { userId, assessmentType: 'stress', score: 55, normalizedScore: 55, rawScore: 11, maxScore: 20,
      responses: json([{q:'overwhelmed',a:3},{q:'concentrating',a:3},{q:'irritable',a:2},{q:'sleep_issues',a:2},{q:'tension',a:1}]),
      categoryScores: {work:60,personal:50,health:55}, completedAt: daysBack(17) },
    // End
    { userId, assessmentType: 'overthinking', score: 38, normalizedScore: 38, rawScore: 8, maxScore: 20,
      responses: json([{q:'ruminate',a:2},{q:'cant_stop',a:2},{q:'replay',a:2},{q:'what_if',a:2}]),
      categoryScores: {rumination:40,intrusive_thoughts:35,decision_anxiety:39}, completedAt: daysBack(0) },
    { userId, assessmentType: 'emotionalIntelligence', score: 78, normalizedScore: 78, rawScore: 16, maxScore: 20,
      responses: json([{q:'awareness',a:4},{q:'empathy',a:4},{q:'regulation',a:4},{q:'social',a:4}]),
      categoryScores: {selfAwareness:80,empathy:78,regulation:76,social:78}, completedAt: daysBack(0) },
  ];
}

// ─── Chat conversations ───────────────────────────────────────────────────────

function priyaConversations(userId: string) {
  return [
    {
      userId, startedAt: daysBack(32), endedAt: daysBack(32, -1),
      emotionalState: 'anxious', urgencyLevel: 'medium',
      keyTopics: json(['exam anxiety', 'sleep problems', 'overwhelm']),
      summary: 'Priya opened up about intense exam anxiety and difficulty sleeping. Bot provided psychoeducation about anxiety cycle and introduced 4-7-8 breathing. User seemed receptive and committed to trying it tonight.',
      messages: json([
        { role: 'user', content: "I can't sleep and my exams are in 3 weeks. I feel like I'm going to fail everything.", timestamp: daysBack(32).toISOString() },
        { role: 'bot', content: "That sounds really overwhelming – three weeks can feel both too close and strangely far away when anxiety is high. What's been the most difficult part: the studying itself, the fear of the result, or the sleeplessness?", timestamp: daysBack(32, -0.05).toISOString() },
        { role: 'user', content: "Both honestly. My mind races at 2am and I can't switch it off.", timestamp: daysBack(32, -0.1).toISOString() },
        { role: 'bot', content: "Racing thoughts at 2am are one of anxiety's most exhausting tricks. Your mind is trying to 'solve' the exam by worrying about it, which actually makes it harder to study effectively the next day. Would you be willing to try a short breathing technique right now that can slow that racing down?", timestamp: daysBack(32, -0.15).toISOString() },
        { role: 'user', content: "Sure, I'll try anything at this point.", timestamp: daysBack(32, -0.2).toISOString() },
        { role: 'bot', content: "Try the 4-7-8 breath: Inhale through your nose for 4 counts, hold for 7 counts, exhale slowly through your mouth for 8 counts. Do this 3 times. It activates your parasympathetic system – the 'rest and digest' mode. How do you feel after trying it?", timestamp: daysBack(32, -0.25).toISOString() },
        { role: 'user', content: "Actually... a bit calmer. My chest isn't as tight.", timestamp: daysBack(32, -0.35).toISOString() },
        { role: 'bot', content: "That's real. Even 3 rounds can shift your nervous system state. You didn't solve the exams just now, but you gave your mind a moment of safety. That matters. Would you like me to suggest a simple sleep routine for the next few nights?", timestamp: daysBack(32, -0.4).toISOString() },
        { role: 'user', content: "Yes please, I really need help with that.", timestamp: daysBack(32, -0.45).toISOString() },
        { role: 'bot', content: "Here's a gentle routine: 30 mins before bed – no screens, dim lights, write down 3 things you accomplished today (even small ones), then do 5 minutes of 4-7-8 breathing. In the morning, study in focused 25-minute blocks with 5-minute breaks. You're already showing great insight by reaching out tonight.", timestamp: daysBack(32, -0.5).toISOString() },
      ]),
    },
    {
      userId, startedAt: daysBack(20), endedAt: daysBack(20, -1),
      emotionalState: 'hopeful', urgencyLevel: 'low',
      keyTopics: json(['internship rejection', 'self-worth', 'resilience']),
      summary: 'Priya shared disappointment about internship rejection but showed emerging resilience. Explored self-worth beyond outcomes. Bot helped reframe the rejection using a growth mindset approach.',
      messages: json([
        { role: 'user', content: "Got rejected from my dream internship. I feel worthless.", timestamp: daysBack(20).toISOString() },
        { role: 'bot', content: "Rejection from something you really wanted is genuinely painful. Your feelings make complete sense. Before we talk about next steps – how are you doing right now, in this moment?", timestamp: daysBack(20, -0.05).toISOString() },
        { role: 'user', content: "Sad, embarrassed, wondering if I'm just not good enough.", timestamp: daysBack(20, -0.1).toISOString() },
        { role: 'bot', content: "That thought – 'I'm not good enough' – is one of rejection's most painful additions. But let me gently challenge it: one company's decision at one point in time tells you something about fit, timing, and competition. It doesn't define your worth or your future. What strengths did you bring to that application?", timestamp: daysBack(20, -0.15).toISOString() },
        { role: 'user', content: "I worked really hard on my project. I guess that showed good dedication.", timestamp: daysBack(20, -0.2).toISOString() },
        { role: 'bot', content: "That dedication is yours – no one can reject it. The same energy that built that project will build the next one. What if this rejection is redirecting you toward something even better aligned with you?", timestamp: daysBack(20, -0.25).toISOString() },
        { role: 'user', content: "I hadn't thought of it that way. Maybe I'll apply to 3 more places tomorrow.", timestamp: daysBack(20, -0.3).toISOString() },
        { role: 'bot', content: "That's exactly the right move. Each application is a skill you're building. I'm genuinely proud of how you shifted just in this conversation – from 'I'm worthless' to 'I'll apply tomorrow.' That's resilience in action.", timestamp: daysBack(20, -0.35).toISOString() },
      ]),
    },
    {
      userId, startedAt: daysBack(5), endedAt: daysBack(5, -1),
      emotionalState: 'excited', urgencyLevel: 'low',
      keyTopics: json(['internship success', 'interview preparation', 'gratitude']),
      summary: 'Priya came in excited about internship interview. Focused on preparation strategies and managing pre-interview nerves. Ended with gratitude for the journey over the past month.',
      messages: json([
        { role: 'user', content: "I got called for an interview! I'm nervous but so excited.", timestamp: daysBack(5).toISOString() },
        { role: 'bot', content: "This is wonderful news – you absolutely earned this callback! Excitement and nerves together is actually the optimal performance state. What's making you most nervous?", timestamp: daysBack(5, -0.05).toISOString() },
        { role: 'user', content: "The technical questions. What if I blank out?", timestamp: daysBack(5, -0.1).toISOString() },
        { role: 'bot', content: "Blanking under pressure is a common fear, and there's a simple fix: when in doubt, think out loud. Interviewers value your thought process more than a perfect answer. Practice saying 'Let me think through this step by step' – it buys you time and shows structured thinking.", timestamp: daysBack(5, -0.15).toISOString() },
        { role: 'user', content: "That's actually really helpful. I've been using the breathing you taught me before stressful situations.", timestamp: daysBack(5, -0.2).toISOString() },
        { role: 'bot', content: "You remembered and used it – that's real growth. Do it 3 times before walking into the interview. You've come a long way this month. From racing thoughts at 2am to walking into an internship interview. That's you.", timestamp: daysBack(5, -0.25).toISOString() },
      ]),
    },
  ];
}

function rohanConversations(userId: string) {
  return [
    {
      userId, startedAt: daysBack(33), endedAt: daysBack(33, -1),
      emotionalState: 'overwhelmed', urgencyLevel: 'medium',
      keyTopics: json(['work overload', 'burnout signs', 'boundary setting']),
      summary: 'Rohan presented with clear burnout symptoms. Three consecutive late nights. Explored the cycle of overwork and discussed boundary-setting strategies from a CBT perspective.',
      messages: json([
        { role: 'user', content: "I've worked until midnight three days straight. I'm so tired I feel sick.", timestamp: daysBack(33).toISOString() },
        { role: 'bot', content: "That level of exhaustion is serious – your body is sending you a clear signal. Three late nights in a row affects cognition, mood regulation, and even immune function. What's driving the overwork – is it expectation from above, your own standards, or both?", timestamp: daysBack(33, -0.05).toISOString() },
        { role: 'user', content: "Mostly my own standards. I feel like if I don't do it perfectly no one will respect my work.", timestamp: daysBack(33, -0.1).toISOString() },
        { role: 'bot', content: "That belief – 'perfectionism equals respect' – is very common in high-performing people, and it's quietly exhausting. What's the evidence that good-enough work gets disrespected? Has that actually happened?", timestamp: daysBack(33, -0.15).toISOString() },
        { role: 'user', content: "...Not really, now that I think about it. My manager usually just cares that it's done.", timestamp: daysBack(33, -0.2).toISOString() },
        { role: 'bot', content: "That's a significant insight. Your perfectionism standard is higher than what's actually required for respect. This gap is where a lot of your energy is being drained. What would 'good enough' look like for tomorrow's tasks?", timestamp: daysBack(33, -0.25).toISOString() },
        { role: 'user', content: "I guess... finishing the core features without the extra edge cases I was adding.", timestamp: daysBack(33, -0.3).toISOString() },
        { role: 'bot', content: "Exactly. Core features shipped on time, edge cases in backlog. That's not lowering quality – it's making sustainable decisions. Tonight: can you commit to shutting down by 8pm and doing something non-work before sleep?", timestamp: daysBack(33, -0.35).toISOString() },
        { role: 'user', content: "I'll try. Watch TV maybe. Haven't done that in weeks.", timestamp: daysBack(33, -0.4).toISOString() },
        { role: 'bot', content: "TV, a walk, music – whatever genuinely switches you off. Your brain needs recovery time to perform well. You're not being lazy by resting; you're investing in tomorrow's performance.", timestamp: daysBack(33, -0.45).toISOString() },
      ]),
    },
    {
      userId, startedAt: daysBack(22), endedAt: daysBack(22, -1),
      emotionalState: 'improving', urgencyLevel: 'low',
      keyTopics: json(['CBT techniques', 'cognitive reframing', 'workplace communication']),
      summary: 'Rohan returning to check in. Showing significant improvement. Worked through a specific cognitive distortion about the manager feedback. Applied CBT thought record technique.',
      messages: json([
        { role: 'user', content: "Last week my manager gave me feedback and I spiralled into thinking I was getting fired.", timestamp: daysBack(22).toISOString() },
        { role: 'bot', content: "That jump from 'feedback' to 'I'm getting fired' is a classic cognitive distortion called catastrophising. Your brain skipped several logical steps. Let's walk through what actually happened – what did your manager say, exactly?", timestamp: daysBack(22, -0.05).toISOString() },
        { role: 'user', content: "She said 'your documentation could be more thorough'. That was it.", timestamp: daysBack(22, -0.1).toISOString() },
        { role: 'bot', content: "One specific, actionable comment about documentation. On a scale of 1-10, how serious does that actually sound now that you say it out loud?", timestamp: daysBack(22, -0.15).toISOString() },
        { role: 'user', content: "Maybe... a 3. It's literally just docs.", timestamp: daysBack(22, -0.2).toISOString() },
        { role: 'bot', content: "Exactly. Your anxious brain inflated a 3 into a 10. This is the CBT thought record – situation, automatic thought, evidence for, evidence against, balanced thought. Yours: 'My manager wants better docs' not 'I'm about to be fired.' How would you handle this if it were a colleague's situation?", timestamp: daysBack(22, -0.25).toISOString() },
        { role: 'user', content: "I'd tell them to just improve the docs and move on. Simple.", timestamp: daysBack(22, -0.3).toISOString() },
        { role: 'bot', content: "Give yourself the same advice you'd give your colleague. You deserve that same rational compassion. You're getting good at catching these distortions – that's real cognitive flexibility developing.", timestamp: daysBack(22, -0.35).toISOString() },
      ]),
    },
    {
      userId, startedAt: daysBack(3), endedAt: daysBack(3, -1),
      emotionalState: 'hopeful', urgencyLevel: 'low',
      keyTopics: json(['promotion', 'future planning', 'mental wellness progress']),
      summary: 'Rohan celebrating promotion news. Reflected on mental health journey over the month. Discussed maintaining habits during the new role transition. Very positive session.',
      messages: json([
        { role: 'user', content: "I got promoted! I wanted to share it here because this platform helped me get here.", timestamp: daysBack(3).toISOString() },
        { role: 'bot', content: "Congratulations! That's genuinely wonderful news. But I want to be clear – that promotion came from your work, your growth, your resilience. I just helped you see what was already there.", timestamp: daysBack(3, -0.05).toISOString() },
        { role: 'user', content: "I was such a mess 5 weeks ago. Three late nights, feeling worthless. Now this.", timestamp: daysBack(3, -0.1).toISOString() },
        { role: 'bot', content: "The distance between then and now is real and meaningful. You did the hard work – caught your cognitive distortions, set better boundaries, started running again. Those weren't just nice-to-haves; they were what made the promotion possible.", timestamp: daysBack(3, -0.15).toISOString() },
        { role: 'user', content: "What do I do to not slip back into old patterns in the new role?", timestamp: daysBack(3, -0.2).toISOString() },
        { role: 'bot', content: "Great question. Three anchors: 1) Keep the Sunday run – it's your reset button. 2) Use the thought record when work stress starts distorting. 3) Set a hard stop time at least 4 nights a week. The new role will bring new pressures; your job is to respond, not react.", timestamp: daysBack(3, -0.25).toISOString() },
      ]),
    },
  ];
}

function ananyaConversations(userId: string) {
  return [
    {
      userId, startedAt: daysBack(31), endedAt: daysBack(31, -1),
      emotionalState: 'exhausted', urgencyLevel: 'medium',
      keyTopics: json(['sleep problems', 'overthinking', 'school pressure']),
      summary: 'Ananya presented with chronic sleep difficulties due to overthinking. Described waking at 3am with a racing mind about school-related concerns. Introduced sleep hygiene principles and body scan meditation.',
      messages: json([
        { role: 'user', content: "I wake up at 3am every night. My mind just replays everything from the day – conversations, mistakes, what I should have said.", timestamp: daysBack(31).toISOString() },
        { role: 'bot', content: "That 3am replay loop is one of the most common – and most exhausting – forms of overthinking. Your brain is in 'threat detection' mode when it should be in 'recovery' mode. How long has this been happening?", timestamp: daysBack(31, -0.05).toISOString() },
        { role: 'user', content: "At least 6 months. Since I took on the head of department role.", timestamp: daysBack(31, -0.1).toISOString() },
        { role: 'bot', content: "The timing makes sense – increased responsibility often activates hypervigilance. Your mind is trying to 'protect' you by staying alert, but in the middle of the night there's nothing to protect against. There's a specific practice that can interrupt this: body scan meditation before sleep. Would you like to try it?", timestamp: daysBack(31, -0.15).toISOString() },
        { role: 'user', content: "I've heard of it but never tried. My sister does yoga, maybe I should start that too.", timestamp: daysBack(31, -0.2).toISOString() },
        { role: 'bot', content: "Yoga is excellent – it processes stress held in the body, not just the mind. But start with the body scan tonight: lying down, slowly bring attention from toes to head, breathing into each area. The replay loop can't fully operate when attention is in the body. Can you commit to 10 minutes tonight?", timestamp: daysBack(31, -0.25).toISOString() },
        { role: 'user', content: "Yes I can do that. Should I do it in bed?", timestamp: daysBack(31, -0.3).toISOString() },
        { role: 'bot', content: "In bed is fine. Also: avoid screens 45 minutes before bed, keep room slightly cool, write your 'tomorrow worries' in a notebook before starting – externalising them empties the mental cache. If you wake at 3am, try 4-7-8 breathing rather than reaching for your phone.", timestamp: daysBack(31, -0.35).toISOString() },
      ]),
    },
    {
      userId, startedAt: daysBack(14), endedAt: daysBack(14, -1),
      emotionalState: 'improving', urgencyLevel: 'low',
      keyTopics: json(['sleep improvement', 'yoga progress', 'self-compassion']),
      summary: 'Ananya reporting meaningful sleep improvement. Discussing self-compassion around perfectionism. Exploring the connection between her identity and professional performance.',
      messages: json([
        { role: 'user', content: "I slept 6.5 hours last night without waking! First time in months.", timestamp: daysBack(14).toISOString() },
        { role: 'bot', content: "That is real, meaningful progress. What changed?", timestamp: daysBack(14, -0.05).toISOString() },
        { role: 'user', content: "I've been doing the body scan every night and yoga in the mornings. Also writing my worries in a notebook.", timestamp: daysBack(14, -0.1).toISOString() },
        { role: 'bot', content: "You built a system and kept to it consistently. That's discipline and self-care working together. I notice you started all three things at once – that shows strong commitment. How does it feel to be taking care of yourself this way?", timestamp: daysBack(14, -0.15).toISOString() },
        { role: 'user', content: "Strange, honestly. I always put students and school first. I feel guilty spending time on myself.", timestamp: daysBack(14, -0.2).toISOString() },
        { role: 'bot', content: "That guilt is worth examining. When you sleep better, are you a better teacher? When you're less anxious, do your students benefit?", timestamp: daysBack(14, -0.25).toISOString() },
        { role: 'user', content: "...Yes. I was much more patient this week. A student had a breakdown and I handled it so calmly.", timestamp: daysBack(14, -0.3).toISOString() },
        { role: 'bot', content: "Your self-care directly created that calm presence for your student. Self-compassion isn't selfish; it's the foundation of sustainable service to others. You can't pour from an empty cup.", timestamp: daysBack(14, -0.35).toISOString() },
      ]),
    },
    {
      userId, startedAt: daysBack(1), endedAt: daysBack(1, -1),
      emotionalState: 'peaceful', urgencyLevel: 'low',
      keyTopics: json(['ashram retreat', 'gratitude', 'sustained wellbeing']),
      summary: 'Ananya sharing insights from a weekend ashram retreat. Reflecting on month-long transformation. Discussed sustaining practices during busy school terms.',
      messages: json([
        { role: 'user', content: "I just returned from a 2-day ashram retreat. It was transformative.", timestamp: daysBack(1).toISOString() },
        { role: 'bot', content: "I can feel the peace in your words – that's a different energy from when you first came here. What was the most impactful part of the retreat?", timestamp: daysBack(1, -0.05).toISOString() },
        { role: 'user', content: "Silence. Three hours of silence each morning. I realised I'm constantly surrounded by noise – school, home, my own thoughts. The silence was like oxygen.", timestamp: daysBack(1, -0.1).toISOString() },
        { role: 'bot', content: "That's profound. Noise – external and internal – has been your default state for years. And in silence you found that... what was there?", timestamp: daysBack(1, -0.15).toISOString() },
        { role: 'user', content: "Just me. Not the teacher, not the mother, not the head of department. Just Ananya. It was strange and beautiful.", timestamp: daysBack(1, -0.2).toISOString() },
        { role: 'bot', content: "That's one of the most powerful things a person can discover. All those roles are things you do, not who you are. You're Ananya first. How can you preserve even a small piece of that silence in your daily life?", timestamp: daysBack(1, -0.25).toISOString() },
        { role: 'user', content: "Morning yoga already creates that. Maybe I'll add 10 minutes of just sitting before I start work.", timestamp: daysBack(1, -0.3).toISOString() },
        { role: 'bot', content: "Ten minutes of presence before the world demands your attention. That's a beautiful anchor. You've done something genuinely difficult this month – you prioritised yourself while caring for others. That's the art. I'm honoured to have been part of your journey.", timestamp: daysBack(1, -0.35).toISOString() },
      ]),
    },
  ];
}

// ─── Therapist booking ────────────────────────────────────────────────────────

async function ensureTherapist() {
  // Create a demo therapist if none exist
  const existing = await prisma.therapist.findFirst({ where: { isActive: true } });
  if (existing) return existing;

  return prisma.therapist.create({
    data: {
      name: 'Dr. Kavya Nair',
      credential: 'PSYCHOLOGIST',
      title: 'Licensed Clinical Psychologist',
      bio: 'Dr. Kavya Nair is a certified clinical psychologist with 12 years of experience specialising in anxiety, stress management, and cognitive behavioural therapy. She blends Western evidence-based approaches with mindfulness-informed practices.',
      specialtiesJson: json(['ANXIETY', 'STRESS_MANAGEMENT', 'CBT', 'MINDFULNESS', 'DEPRESSION']),
      email: 'dr.kavya.nair@manasarathi.app',
      city: 'Bengaluru', state: 'Karnataka', country: 'IN',
      acceptsInsurance: false, sessionFee: 1500, offersSliding: true,
      yearsExperience: 12, languages: 'English,Kannada,Hindi,Malayalam',
      rating: 4.8, reviewCount: 156,
      isActive: true, isVerified: true,
      availabilityJson: json([
        { day: 'Monday', slots: ['10:00', '11:00', '14:00', '15:00'] },
        { day: 'Wednesday', slots: ['10:00', '11:00', '16:00', '17:00'] },
        { day: 'Friday', slots: ['09:00', '10:00', '11:00'] },
      ]),
    },
  });
}

// ─── Main seeder ─────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🌱 ManaSarathi Test User Seeder\n');
  console.log('Creating 3 realistic users with ~35 days of activity...\n');

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
  const therapist = await ensureTherapist();
  console.log(`✅ Therapist ready: ${therapist.name} (${therapist.id})\n`);

  // Fetch first existing content/practices to link engagements
  const contentItems = await prisma.content.findMany({ where: { isPublished: true }, take: 8 });
  const practiceItems = await prisma.practice.findMany({ where: { isPublished: true }, take: 6 });

  const userData = [
    { def: USERS[0], moodArc: PRIYA_MOODS,  assessmentsFn: priyaAssessments,  convFn: priyaConversations  },
    { def: USERS[1], moodArc: ROHAN_MOODS,  assessmentsFn: rohanAssessments,  convFn: rohanConversations  },
    { def: USERS[2], moodArc: ANANYA_MOODS, assessmentsFn: ananyaAssessments, convFn: ananyaConversations },
  ];

  for (const { def, moodArc, assessmentsFn, convFn } of userData) {
    console.log(`──────────────────────────────────────────`);
    console.log(`👤 Seeding: ${def.name} (${def.email})`);

    // 1. Upsert user
    const user = await prisma.user.upsert({
      where: { email: def.email },
      update: {},
      create: {
        email: def.email,
        name: def.name,
        firstName: def.firstName,
        lastName: def.lastName,
        password: passwordHash,
        gender: def.gender,
        birthday: def.birthday,
        region: def.region,
        approach: def.approach,
        language: def.language,
        isOnboarded: true,
        isEmailVerified: true,
        dataConsent: true,
        clinicianSharing: true,
        anonymousAnalytics: true,
        createdAt: daysBack(36),
      },
    });
    console.log(`  ✅ User created: ${user.id}`);

    // 2. Mood entries (35 days)
    for (let i = 0; i < moodArc.length; i++) {
      const entry = moodArc[i];
      await prisma.moodEntry.create({
        data: {
          userId: user.id,
          mood: entry.mood,
          emotion: entry.emotion,
          emotionGroup: ['joy','trust','fear','surprise','sadness','disgust','anger','anticipation'][Math.floor(Math.random()*8)],
          intensity: entry.intensity,
          trigger: (entry as any).trigger ?? null,
          notes: entry.notes,
          createdAt: daysBack(35 - i),
        },
      });
    }
    console.log(`  ✅ 35 mood entries`);

    // 3. Assessments
    const assessments = assessmentsFn(user.id);
    for (const a of assessments) {
      await prisma.assessmentResult.create({ data: a });
    }
    console.log(`  ✅ ${assessments.length} assessments`);

    // 4. Journal entries (every 3-4 days)
    const journalTemplates = [
      "Today was hard. I kept wondering if I'm doing enough. But I showed up, and that counts.",
      "Started the breathing exercise before bed. Slept earlier than usual. Small win.",
      "Feeling more settled today. Something clicked after the chatbot session last night.",
      "I've been thinking about what truly matters. Work, relationships, or peace of mind?",
      "Had a moment of real calm today. Didn't think I'd say that three weeks ago.",
      "Gratitude list: good weather, a kind message from a friend, a decent meal. Basics matter.",
      "Fell back into old patterns today. That's okay. Tomorrow is fresh.",
      "Progress isn't linear. I had a great week and then one bad day. The week still happened.",
    ];
    for (let j = 0; j < 10; j++) {
      await prisma.journalEntry.create({
        data: {
          userId: user.id,
          content: journalTemplates[j % journalTemplates.length],
          mood: pick(['Good', 'Okay', 'Anxious', 'Great']),
          tags: json(['reflection', 'growth']),
          createdAt: daysBack(35 - j * 3),
        },
      });
    }
    console.log(`  ✅ 10 journal entries`);

    // 5. Gratitude entries
    for (let g = 0; g < 12; g++) {
      const gratitudeOptions = [
        ['My morning tea', 'A good conversation', 'Sunlight through the window'],
        ['Managing to sleep well', 'A supportive friend', 'Getting through the day'],
        ['Progress on my goals', 'Health', 'Access to this app'],
        ['Family', 'A calm moment', 'Small achievements'],
      ];
      await prisma.gratitudeEntry.create({
        data: {
          userId: user.id,
          items: gratitudeOptions[g % gratitudeOptions.length],
          createdAt: daysBack(34 - g * 2),
        },
      });
    }
    console.log(`  ✅ 12 gratitude entries`);

    // 6. Sleep logs
    const sleepData = [
      { hours: 5.5, quality: 2, notes: 'Woke up multiple times, stressed' },
      { hours: 6.0, quality: 3, notes: 'Okay sleep, some vivid dreams' },
      { hours: 5.0, quality: 2, notes: 'Racing thoughts, hard to fall asleep' },
      { hours: 7.0, quality: 4, notes: 'Used body scan, helped' },
      { hours: 6.5, quality: 3, notes: 'Getting better gradually' },
      { hours: 7.5, quality: 4, notes: 'Best sleep this week' },
      { hours: 8.0, quality: 5, notes: 'Excellent, no interruptions' },
      { hours: 7.0, quality: 4, notes: 'Consistent routine paying off' },
    ];
    for (let s = 0; s < sleepData.length; s++) {
      const log = sleepData[s];
      const bedTime = new Date(daysBack(30 - s * 4));
      bedTime.setHours(23, 0, 0);
      const wakeTime = new Date(bedTime);
      wakeTime.setHours(wakeTime.getHours() + log.hours);
      await prisma.sleepLog.create({
        data: {
          userId: user.id,
          bedTime,
          wakeTime,
          quality: log.quality,
          duration: log.hours,
          notes: log.notes,
          factors: ['screen_time', 'stress', 'caffeine'],
          createdAt: daysBack(30 - s * 4),
        },
      });
    }
    console.log(`  ✅ ${sleepData.length} sleep logs`);

    // 7. Daily intentions
    const intentions = [
      'Take one mindful breath before each task', 'Be kind to myself today',
      'Complete one meaningful thing before lunch', 'Notice 3 moments of calm',
      'Reach out to someone I care about', 'Take a 10-minute break outside',
    ];
    for (let int = 0; int < 20; int++) {
      await prisma.dailyIntention.create({
        data: {
          userId: user.id,
          intention: intentions[int % intentions.length],
          isCustom: int % 3 === 0,
          completed: int < 15,
          reflection: int < 10 ? 'Managed to follow through. Small but felt good.' : undefined,
          createdAt: daysBack(34 - int),
        },
      });
    }
    console.log(`  ✅ 20 daily intentions`);

    // 8. Micro check-ins
    for (let mc = 0; mc < 15; mc++) {
      await prisma.microCheckin.create({
        data: {
          userId: user.id,
          type: pick(['morning', 'evening', 'post-chat']),
          mood: pick(['Good', 'Okay', 'Anxious', 'Great']),
          responses: { energy: pick([3,4,5,6,7]), stress: pick([3,4,5,6,7]), focus: pick([3,4,5]) },
          createdAt: daysBack(34 - mc * 2),
        },
      });
    }
    console.log(`  ✅ 15 micro check-ins`);

    // 9. Progress tracking
    const metrics = ['anxiety', 'stress', 'mood', 'sleep'];
    for (const metric of metrics) {
      for (let p = 0; p < 35; p++) {
        // Simulate gentle downward trend for negative metrics
        const base = metric === 'mood' ? 55 : 75;
        const trend = metric === 'mood' ? p * 0.5 : -p * 0.6;
        const noise = (Math.random() - 0.5) * 8;
        await prisma.progressTracking.create({
          data: {
            userId: user.id,
            metric,
            value: Math.max(20, Math.min(100, Math.round(base + trend + noise))),
            date: daysBack(35 - p),
          },
        });
      }
    }
    console.log(`  ✅ 140 progress tracking points`);

    // 10. Habits
    const habitsData = [
      { title: 'Morning breathing exercise', cue: 'Right after waking up', streak: 22 },
      { title: 'Evening journaling', cue: 'After dinner, before screens', streak: 15 },
      { title: 'Mindful walk', cue: 'Lunch break', streak: 10 },
    ];
    for (const h of habitsData) {
      await prisma.userHabit.create({
        data: {
          userId: user.id,
          title: h.title,
          cue: h.cue,
          streak: h.streak,
          active: true,
          lastCompletedAt: daysBack(0),
          createdAt: daysBack(35),
        },
      });
    }
    console.log(`  ✅ 3 habits`);

    // 11. Content engagements
    for (const [ci, c] of contentItems.slice(0, 5).entries()) {
      await prisma.contentEngagement.upsert({
        where: { userId_contentId: { userId: user.id, contentId: c.id } },
        update: {},
        create: {
          userId: user.id,
          contentId: c.id,
          completed: ci < 4,
          rating: pick([3,4,4,5]),
          timeSpent: pick([180, 300, 420, 600]),
          moodBefore: pick(['Anxious', 'Okay', 'Struggling']),
          moodAfter: pick(['Good', 'Okay', 'Great']),
          effectiveness: pick([6, 7, 8, 9]),
          createdAt: daysBack(30 - ci * 5),
        },
      });
    }
    console.log(`  ✅ ${Math.min(5, contentItems.length)} content engagements`);

    // 12. Chatbot conversations
    const convs = convFn(user.id);
    for (const conv of convs) {
      await prisma.chatbotConversation.create({ data: conv });
    }
    console.log(`  ✅ ${convs.length} chatbot conversations`);

    // 13. Conversations + chat messages (legacy model)
    const legacyConv = await prisma.conversation.create({
      data: {
        userId: user.id,
        title: 'First Support Session',
        createdAt: daysBack(33),
        lastMessageAt: daysBack(33, -1),
      },
    });
    await prisma.chatMessage.createMany({
      data: [
        { conversationId: legacyConv.id, userId: user.id, content: "I need some support with my mental health.", type: 'user', createdAt: daysBack(33) },
        { conversationId: legacyConv.id, userId: user.id, content: "Of course, I'm here to listen. What's been on your mind?", type: 'bot', createdAt: daysBack(33, -0.05) },
        { conversationId: legacyConv.id, userId: user.id, content: "I've been feeling overwhelmed and anxious most days.", type: 'user', createdAt: daysBack(33, -0.1) },
        { conversationId: legacyConv.id, userId: user.id, content: "That sounds really hard. Anxiety can make everything feel heavier. Let's work through this together.", type: 'bot', createdAt: daysBack(33, -0.15) },
      ],
    });
    console.log(`  ✅ Legacy conversation + messages`);

    // 14. Conversation goal
    await prisma.conversationGoal.create({
      data: {
        userId: user.id,
        goalType: 'reduce_anxiety',
        title: 'Manage anxiety to below moderate levels',
        description: 'Work towards reducing daily anxiety through mindfulness, breathing, and CBT techniques.',
        targetValue: 40,
        currentValue: def === USERS[0] ? 45 : def === USERS[1] ? 42 : 38,
        status: 'active',
        progress: def === USERS[0] ? 70 : def === USERS[1] ? 75 : 80,
        milestones: json(['Learned breathing techniques', 'Completed first week of journaling', 'Had first good sleep']),
        createdAt: daysBack(35),
      },
    });
    console.log(`  ✅ Conversation goal`);

    // 15. Conversation memory
    await prisma.conversationMemory.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        topics: json({ anxiety: 3, sleep: 2, work: 2, relationships: 1 }),
        emotionalPatterns: json({ common_emotions: ['anxious', 'hopeful', 'exhausted'], trend: 'improving' }),
        importantMoments: json([
          { date: daysBack(33).toISOString(), event: 'First session, breakthrough on breathing' },
          { date: daysBack(14).toISOString(), event: 'Sleep improvement achieved' },
        ]),
        conversationMetrics: json({ total_sessions: 3, avg_session_length: 8, engagement_score: 85 }),
        lastSessionSummary: 'User showing consistent improvement. Maintaining healthy habits and emotional regulation.',
        lastSessionDate: daysBack(1),
        createdAt: daysBack(35),
      },
    });
    console.log(`  ✅ Conversation memory`);

    // 16. Wellness snapshot
    await prisma.wellnessSnapshot.create({
      data: {
        userId: user.id,
        wellnessScore: def === USERS[0] ? 68 : def === USERS[1] ? 71 : 74,
        assessmentScores: json({ anxiety: 45, stress: 42, emotionalIntelligence: 74 }),
        moodAverage: 'Good',
        engagementLevel: 'high',
        recordedAt: daysBack(1),
        periodStart: daysBack(35),
        periodEnd: daysBack(1),
      },
    });
    console.log(`  ✅ Wellness snapshot`);

    // 17. User session tracking (login history)
    for (let ls = 0; ls < 25; ls++) {
      await prisma.userSession.create({
        data: {
          userId: user.id,
          startedAt: daysBack(35 - ls),
          endedAt: new Date(daysBack(35 - ls).getTime() + pick([900, 1200, 1800, 2400, 3600]) * 1000),
          duration: pick([900, 1200, 1800, 2400, 3600]),
          pagesViewed: pick([3, 5, 7, 9, 12]),
          actionsPerformed: pick([5, 8, 12, 15, 20]),
          featuresUsed: json(pick([
            ['mood_tracker', 'journal', 'chatbot'],
            ['assessment', 'practices', 'mood_tracker'],
            ['chatbot', 'therapist_directory', 'journal'],
          ])),
          deviceType: pick(['mobile', 'desktop']),
          browserInfo: 'Chrome/125',
        },
      });
    }
    console.log(`  ✅ 25 user sessions (login history)`);

    // 18. Therapist booking
    await prisma.therapistBooking.create({
      data: {
        userId: user.id,
        therapistId: therapist.id,
        preferredDate: daysBack(-7), // a week in the future
        preferredTime: pick(['10:00', '11:00', '14:00', '15:00']),
        message: `I've been using ManaSarathi for about a month and I feel ready to work with a therapist directly. My main concerns are ${def.profile}`,
        userEmail: def.email,
        userPhone: '+91 98765 43210',
        status: pick(['PENDING', 'CONFIRMED']),
        createdAt: daysBack(3),
      },
    });
    console.log(`  ✅ Therapist booking (Dr. ${therapist.name})`);

    console.log(`  🎉 ${def.name} seeded successfully!\n`);
  }

  console.log('══════════════════════════════════════════════');
  console.log('✅ All 3 test users seeded successfully!\n');
  console.log('📋 Login credentials (password for all: Test@1234)\n');
  console.log('┌─────────────────────────────────────────────────────────────────┐');
  console.log('│  User 1: Priya Sharma (22, Student, Anxiety + Burnout)          │');
  console.log('│  Email:  priya.sharma.test@manasarathi.app                      │');
  console.log('│  Pass:   Test@1234                                              │');
  console.log('├─────────────────────────────────────────────────────────────────┤');
  console.log('│  User 2: Rohan Mehra (35, IT Professional, Stress + Depression) │');
  console.log('│  Email:  rohan.mehra.test@manasarathi.app                       │');
  console.log('│  Pass:   Test@1234                                              │');
  console.log('├─────────────────────────────────────────────────────────────────┤');
  console.log('│  User 3: Ananya Iyer (45, Teacher, Sleep + Overthinking)        │');
  console.log('│  Email:  ananya.iyer.test@manasarathi.app                       │');
  console.log('│  Pass:   Test@1234                                              │');
  console.log('└─────────────────────────────────────────────────────────────────┘');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
