import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Starting basic_overall assessment migration...');

  // Update basic_overall assessment definition
  const basicOverall = await prisma.assessmentDefinition.findFirst({
    where: {
      OR: [
        { type: 'Combined' },
        { id: 'basic_overall' }
      ]
    }
  });

  if (basicOverall) {
    console.log(`Found basic_overall assessment: ${basicOverall.name} (ID: ${basicOverall.id})`);
    
    await prisma.assessmentDefinition.update({
      where: { id: basicOverall.id },
      data: {
        isBasicOverallOnly: false,
        visibleInMainList: true
      }
    });

    console.log('Updated basic_overall to be a standalone visible individual assessment.');
  } else {
    console.log('basic_overall assessment not found in database.');
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
