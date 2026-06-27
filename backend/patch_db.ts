import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const anxietyConfig = {
  minScore: 0,
  maxScore: 21,
  interpretationBands: [
    { max: 4, label: 'Minimal Anxiety', color: '#10b981' },
    { max: 9, label: 'Mild Anxiety', color: '#fbbf24' },
    { max: 14, label: 'Moderate Anxiety', color: '#f97316' },
    { max: 21, label: 'Severe Anxiety', color: '#ef4444' }
  ],
  sourceName: 'PHQ Screeners / GAD-7',
  sourceUrl: 'https://www.phqscreeners.com/',
  clinicalNote: 'GAD-7 is a screening and symptom-monitoring tool, not a standalone diagnosis.'
};

const anxietyGad2Config = {
  minScore: 0,
  maxScore: 6,
  interpretationBands: [
    { max: 2, label: 'Minimal anxiety', color: '#10b981' },
    { max: 4, label: 'Mild anxiety symptoms', color: '#fbbf24' },
    { max: 6, label: 'Elevated anxiety symptoms', color: '#ef4444' }
  ],
  sourceName: 'PHQ Screeners / GAD-2',
  sourceUrl: 'https://www.phqscreeners.com/',
  clinicalNote: 'GAD-2 is a brief screen; high scores warrant fuller assessment.'
};

async function main() {
  await prisma.assessmentDefinition.updateMany({
    where: { id: 'anxiety' },
    data: { scoringConfig: JSON.stringify(anxietyConfig) }
  });
  console.log('Updated scoringConfig for anxiety');

  await prisma.assessmentDefinition.updateMany({
    where: { id: 'anxiety_gad2' },
    data: { scoringConfig: JSON.stringify(anxietyGad2Config) }
  });
  console.log('Updated scoringConfig for anxiety_gad2');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
