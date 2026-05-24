import dotenv from 'dotenv';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { chatService } from './src/services/chatService';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const prisma = new PrismaClient();

async function runTest() {
  console.log('\n🤖 Chatbot Neutral Prompt Response Test\n');
  
  try {
    let testUser = await prisma.user.findUnique({
      where: { email: 'test-chatbot@example.com' }
    });

    if (!testUser) {
      testUser = await prisma.user.create({
        data: {
          email: 'test-chatbot@example.com',
          name: 'Test Chatbot User',
          password: 'test-password-hash',
          isEmailVerified: true,
          approach: 'hybrid',
          language: 'en'
        }
      });
    }

    const testMessage = 'What is mindfulness, and how can it help with daily stress?';
    console.log('📝 Sending Neutral Prompt:', testMessage);
    console.log('⏱️  Waiting for AI provider response...\n');

    const startTime = Date.now();
    const response = await chatService.generateAIResponse(
      testUser.id,
      testMessage,
      undefined,
      undefined,
      { simpleLanguage: false }
    );
    const duration = Date.now() - startTime;

    console.log('─'.repeat(60));
    console.log('Bot Response:');
    console.log(`"${response.botMessage?.content || response.response}"`);
    console.log('\nResponse Details:');
    console.log(`  Provider: ${response.provider}`);
    console.log(`  Model: ${response.model}`);
    console.log(`  Time taken: ${duration}ms`);
    console.log('─'.repeat(60) + '\n');

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
