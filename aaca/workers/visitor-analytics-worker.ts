import { Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { Logger } from '../utils/logger';

const prisma = new PrismaClient();
const logger = new Logger('VisitorAnalyticsWorker');

export async function processVisitorAnalytics(job: Job): Promise<void> {
  const { sessionId, data } = job.data;
  
  if (!sessionId) {
    throw new Error('No sessionId provided in visitor-analytics job');
  }

  logger.info(`Processing analytics for session: ${sessionId}`);

  try {
    await prisma.visitorSession.upsert({
      where: { sessionId },
      update: {
        leadScore: data.leadScore,
        intent: data.intent,
        styleSwitches: data.styleSwitches,
        userPersona: data.userPersona,
        psychologicalProfile: data.psychologicalProfile,
        behavioralReport: data.behavioralReport,
        lastPage: data.lastPage,
        language: data.language,
        updatedAt: new Date(),
      },
      create: {
        sessionId,
        leadScore: data.leadScore,
        intent: data.intent || 'browsing',
        styleSwitches: data.styleSwitches || 0,
        userPersona: data.userPersona || null,
        psychologicalProfile: data.psychologicalProfile || null,
        behavioralReport: data.behavioralReport || null,
        lastPage: data.lastPage || null,
        language: data.language || 'ar',
      }
    });
    
    logger.info(`Successfully updated analytics for session: ${sessionId}`);
  } catch (error) {
    logger.error(`Error processing analytics for session ${sessionId}`, { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}
