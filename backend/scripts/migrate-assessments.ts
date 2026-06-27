import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MINI_IPIP_DOMAINS = [
  {
    id: 'extraversion',
    label: 'Extraversion',
    minScore: 4,
    maxScore: 20,
    interpretationBands: [
      { max: 8, label: 'Subtle trait expression', color: '#6fa3b5' },
      { max: 15, label: 'Balanced trait expression', color: '#10b981' },
      { max: 20, label: 'Strong trait expression', color: '#8b5cf6' }
    ]
  },
  {
    id: 'agreeableness',
    label: 'Agreeableness',
    minScore: 4,
    maxScore: 20,
    interpretationBands: [
      { max: 8, label: 'Subtle trait expression', color: '#6fa3b5' },
      { max: 15, label: 'Balanced trait expression', color: '#10b981' },
      { max: 20, label: 'Strong trait expression', color: '#8b5cf6' }
    ]
  },
  {
    id: 'conscientiousness',
    label: 'Conscientiousness',
    minScore: 4,
    maxScore: 20,
    interpretationBands: [
      { max: 8, label: 'Subtle trait expression', color: '#6fa3b5' },
      { max: 15, label: 'Balanced trait expression', color: '#10b981' },
      { max: 20, label: 'Strong trait expression', color: '#8b5cf6' }
    ]
  },
  {
    id: 'neuroticism',
    label: 'Neuroticism',
    minScore: 4,
    maxScore: 20,
    interpretationBands: [
      { max: 8, label: 'Subtle trait expression', color: '#6fa3b5' },
      { max: 15, label: 'Balanced trait expression', color: '#10b981' },
      { max: 20, label: 'Strong trait expression', color: '#8b5cf6' }
    ]
  },
  {
    id: 'openness',
    label: 'Openness',
    minScore: 4,
    maxScore: 20,
    interpretationBands: [
      { max: 8, label: 'Subtle trait expression', color: '#6fa3b5' },
      { max: 15, label: 'Balanced trait expression', color: '#10b981' },
      { max: 20, label: 'Strong trait expression', color: '#8b5cf6' }
    ]
  }
];

const MINI_IPIP_QUESTIONS_MAP: Record<string, { domain: string; reverse: boolean }> = {
  q1: { domain: 'extraversion', reverse: false },
  q2: { domain: 'extraversion', reverse: false },
  q3: { domain: 'extraversion', reverse: true },
  q4: { domain: 'extraversion', reverse: true },
  q5: { domain: 'agreeableness', reverse: false },
  q6: { domain: 'agreeableness', reverse: false },
  q7: { domain: 'agreeableness', reverse: true },
  q8: { domain: 'agreeableness', reverse: true },
  q9: { domain: 'conscientiousness', reverse: false },
  q10: { domain: 'conscientiousness', reverse: false },
  q11: { domain: 'conscientiousness', reverse: true },
  q12: { domain: 'conscientiousness', reverse: true },
  q13: { domain: 'neuroticism', reverse: false },
  q14: { domain: 'neuroticism', reverse: false },
  q15: { domain: 'neuroticism', reverse: true },
  q16: { domain: 'neuroticism', reverse: true },
  q17: { domain: 'openness', reverse: false },
  q18: { domain: 'openness', reverse: true },
  q19: { domain: 'openness', reverse: false },
  q20: { domain: 'openness', reverse: true }
};

async function main() {
  console.log('🔄 Starting assessment migration...');

  // 1. Update personality_mini_ipip
  const miniIpip = await prisma.assessmentDefinition.findFirst({
    where: {
      OR: [
        { type: 'personality_mini_ipip' },
        { id: 'personality_mini_ipip' }
      ]
    },
    include: { questions: true }
  });

  if (miniIpip) {
    console.log(`Found Mini-IPIP assessment: ${miniIpip.name} (ID: ${miniIpip.id})`);
    
    // Parse current scoringConfig
    let scoringConfigObj: any = {};
    if (miniIpip.scoringConfig) {
      try {
        scoringConfigObj = JSON.parse(miniIpip.scoringConfig);
      } catch (e) {
        scoringConfigObj = {};
      }
    }

    scoringConfigObj.algorithm = 'SUM';
    scoringConfigObj.domains = MINI_IPIP_DOMAINS;

    await prisma.assessmentDefinition.update({
      where: { id: miniIpip.id },
      data: {
        scoringConfig: JSON.stringify(scoringConfigObj)
      }
    });

    console.log('Updated scoringConfig for Mini-IPIP.');

    // Update questions
    for (const question of miniIpip.questions) {
      // Find matching q number (e.g. q1, q2, ...)
      const match = question.id.match(/_q(\d+)$/);
      if (match) {
        const qNum = `q${match[1]}`;
        const mapping = MINI_IPIP_QUESTIONS_MAP[qNum];
        if (mapping) {
          await prisma.assessmentQuestion.update({
            where: { id: question.id },
            data: {
              domain: mapping.domain,
              reverseScored: mapping.reverse
            }
          });
          console.log(`Updated question ${question.id}: domain=${mapping.domain}, reverse=${mapping.reverse}`);
        }
      }
    }
  } else {
    console.log('Mini-IPIP assessment not found in database.');
  }

  console.log('✅ Migration completed successfully!');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
