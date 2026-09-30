import { Worker, Job } from 'bullmq';
import { config } from './config';
import redisConnection from './services/redis';
import prisma from './services/db';
import { sendEmail } from './services/email';
import esClient from './services/elasticsearch';
import { sendSlackNotification } from './services/slack';
import { emailQueueName } from './services/queue';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const worker = new Worker(emailQueueName, async (job: Job) => {
  const { emailId, userId, toEmail, subject, body } = job.data;

  // Rate Limiting Logic
  const currentHour = new Date().toISOString().slice(0, 13); // yyyy-mm-ddTHH
  const rateLimitKey = `rate_limit:${userId}:${currentHour}`;
  
  // Increment counter
  const currentCount = await redisConnection.incr(rateLimitKey);
  
  // Set expiry on first increment (1 hour)
  if (currentCount === 1) {
    await redisConnection.expire(rateLimitKey, 3600);
  }

  if (currentCount > config.scheduler.maxEmailsPerHour) {
    // Limit reached. Delay job to the start of the next hour.
    const now = new Date();
    const nextHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0, 0);
    const delayTime = nextHour.getTime() - now.getTime();
    
    // Notify Slack if the user has a webhook and we just hit the limit (only notify once per hour)
    if (currentCount === config.scheduler.maxEmailsPerHour + 1) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user?.slackWebhook) {
        await sendSlackNotification(user.slackWebhook, `⚠️ Rate limit exceeded! We have delayed your emails until the next hour.`);
      }
    }

    // Move to delayed and throw error to fail current execution, 
    // actually it's better to just use moveToDelayed but in BullMQ V2/V3 throwing inside processor fails job.
    // To delay it without failing, we use job.moveToDelayed
    await job.moveToDelayed(Date.now() + delayTime, job.token!);
    return; // Stop processing
  }

  // Send Email
  try {
    // Simulate/Enforce minimum delay between individual emails (provider throttling)
    if (config.scheduler.minDelayMs > 0) {
      await delay(config.scheduler.minDelayMs);
    }

    const info = await sendEmail(toEmail, subject, body);
    
    // Update DB
    const sentAt = new Date();
    await prisma.email.update({
      where: { id: emailId },
      data: { status: 'SENT', sentAt },
    });

    // Index in Elasticsearch
    await esClient.index({
      index: 'emails',
      id: emailId,
      document: {
        id: emailId,
        userId,
        toEmail,
        subject,
        body,
        status: 'SENT',
        sentAt,
      }
    });

    console.log(`Email ${emailId} sent successfully.`);

  } catch (error: any) {
    // Update DB to failed
    await prisma.email.update({
      where: { id: emailId },
      data: { status: 'FAILED', failedReason: error.message },
    });
    console.error(`Email ${emailId} failed:`, error.message);
    throw error;
  }
}, {
  connection: redisConnection,
  concurrency: config.scheduler.concurrency,
});

worker.on('failed', (job, err) => {
  if (job) {
    console.error(`Job ${job.id} failed with error ${err.message}`);
  }
});

console.log('Worker started');
