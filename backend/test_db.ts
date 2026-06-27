import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const assessments = await prisma.assessmentDefinition.findMany({
    select: {
      id: true,
      name: true,
      type: true,
      scoringConfig: true
    }
  });
  console.log(JSON.stringify(assessments, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
