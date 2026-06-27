import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

const backendRoot = path.join(__dirname, '..');
dotenv.config({ path: path.join(backendRoot, '.env') });

// Normalize SQLite url if local SQLite is being used
const normalizeSqliteDatabaseUrl = () => {
  const databaseUrl = (process.env.DATABASE_URL || '').trim();
  if (!databaseUrl.startsWith('file:')) return;

  const rawPath = databaseUrl.slice('file:'.length);
  if (!rawPath.startsWith('./') && !rawPath.startsWith('../')) return;

  const absolute = path.resolve(backendRoot, rawPath).replace(/\\/g, '/');
  process.env.DATABASE_URL = `file:${absolute}`;
};

normalizeSqliteDatabaseUrl();

const prisma = new PrismaClient();

const mapIntensityToEnum = (level?: string): any => {
  if (!level) return null;
  const lower = level.toLowerCase();
  if (lower === 'low' || lower === 'beginner') return 'BEGINNER';
  if (lower === 'medium' || lower === 'intermediate') return 'INTERMEDIATE';
  if (lower === 'high' || lower === 'advanced') return 'ADVANCED';
  return 'BEGINNER';
};

const mapContentTypeToEnum = (type?: string): any => {
  if (!type) return null;
  const upper = type.toUpperCase();
  return upper;
};

const mapPracticeCategoryToEnum = (cat?: string): any => {
  if (!cat) return null;
  const upper = cat.toUpperCase();
  return upper;
};

async function main() {
  console.log('🌱 Starting import of compiled JSON seed data...\n');

  const seedDataPath = path.join(backendRoot, '../Project Data/seed_data_final.json');
  if (!fs.existsSync(seedDataPath)) {
    console.error(`Error: Seed data file not found at ${seedDataPath}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(seedDataPath, 'utf8');
  const { contents, practices } = JSON.parse(rawData);

  console.log(`Loaded ${contents.length} contents and ${practices.length} practices from JSON.`);

  // 1. Seed Content items
  console.log('\n📄 Seeding Content items...');
  let contentCreated = 0;
  let contentUpdated = 0;

  for (const item of contents) {
    const mappedContent = {
      title: item.title,
      type: item.type,
      contentType: mapContentTypeToEnum(item.contentType),
      category: item.category,
      approach: item.approach,
      content: item.content || '',
      description: item.description,
      youtubeUrl: item.youtubeUrl,
      thumbnailUrl: item.thumbnailUrl,
      duration: item.duration ? item.duration * 60 : null, // Convert minutes to seconds for DB
      difficulty: item.difficulty,
      intensityLevel: mapIntensityToEnum(item.intensityLevel),
      tags: item.tags ? item.tags.join(',') : '',
      focusAreas: item.focusAreas ? JSON.stringify(item.focusAreas) : null,
      immediateRelief: !!item.immediateRelief,
      crisisEligible: !!item.crisisEligible,
      timeOfDay: item.timeOfDay ? JSON.stringify(item.timeOfDay) : null,
      environment: item.environment ? JSON.stringify(item.environment) : null,
      culturalContext: item.culturalContext,
      hasSubtitles: !!item.hasSubtitles,
      transcript: item.transcript,
      isPublished: !!item.isPublished,
      scheduledPublishAt: item.scheduledPublishAt ? new Date(item.scheduledPublishAt) : null,
    };

    // Check if duplicate exists
    const existing = await prisma.content.findFirst({
      where: {
        title: item.title,
        type: item.type,
      },
    });

    if (existing) {
      await prisma.content.update({
        where: { id: existing.id },
        data: mappedContent,
      });
      contentUpdated++;
    } else {
      await prisma.content.create({
        data: mappedContent,
      });
      contentCreated++;
    }
  }
  console.log(`✅ Content Seeding Complete: ${contentCreated} created, ${contentUpdated} updated.`);

  // 2. Seed Practice items
  console.log('\n🧘 Seeding Practice items...');
  let practiceCreated = 0;
  let practiceUpdated = 0;

  for (const item of practices) {
    const mappedPractice = {
      title: item.title,
      type: item.type,
      category: mapPracticeCategoryToEnum(item.category),
      duration: item.duration, // Stored as minutes in DB
      difficulty: item.level || 'Beginner',
      intensityLevel: mapIntensityToEnum(item.intensityLevel),
      approach: item.approach,
      format: item.format,
      description: item.description,
      audioUrl: item.audioUrl,
      videoUrl: item.videoUrl,
      youtubeUrl: item.youtubeUrl,
      thumbnailUrl: item.thumbnailUrl,
      tags: item.tags ? item.tags.join(',') : null,
      instructions: item.instructions,
      benefits: item.benefits,
      precautions: item.precautions,
      focusAreas: item.focusAreas ? JSON.stringify(item.focusAreas) : null,
      immediateRelief: !!item.immediateRelief,
      crisisEligible: !!item.crisisEligible,
      requiredEquipment: item.requiredEquipment ? JSON.stringify(item.requiredEquipment) : null,
      environment: item.environment ? JSON.stringify(item.environment) : null,
      timeOfDay: item.timeOfDay ? JSON.stringify(item.timeOfDay) : null,
      sensoryEngagement: item.sensoryEngagement ? JSON.stringify(item.sensoryEngagement) : null,
      steps: item.steps ? JSON.stringify(item.steps) : null,
      contraindications: item.contraindications ? JSON.stringify(item.contraindications) : null,
      isPublished: !!item.isPublished,
      scheduledPublishAt: item.scheduledPublishAt ? new Date(item.scheduledPublishAt) : null,
    };

    // Check if duplicate exists
    const existing = await prisma.practice.findFirst({
      where: {
        title: item.title,
        type: item.type,
      },
    });

    if (existing) {
      await prisma.practice.update({
        where: { id: existing.id },
        data: mappedPractice,
      });
      practiceUpdated++;
    } else {
      await prisma.practice.create({
        data: mappedPractice,
      });
      practiceCreated++;
    }
  }
  console.log(`✅ Practice Seeding Complete: ${practiceCreated} created, ${practiceUpdated} updated.`);

  console.log('\n🎉 All content and practices successfully imported into the database!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
