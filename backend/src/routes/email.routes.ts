import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import csvParser from 'csv-parser';
import prisma from '../services/db';
import { emailQueue } from '../services/queue';
import esClient from '../services/elasticsearch';

const router = Router();
const upload = multer({ dest: 'uploads/' });

router.post('/schedule', upload.single('file'), async (req, res) => {
  try {
    const { userId, subject, body, scheduledAt, delayMs } = req.body;
    const emails: string[] = [];

    if (req.file) {
      await new Promise((resolve, reject) => {
        fs.createReadStream(req.file!.path)
          .pipe(csvParser())
          .on('data', (row) => {
            // Assuming CSV has a column 'email'
            const email = row.email || row.Email || row.EMAIL;
            if (email) emails.push(email);
          })
          .on('end', resolve)
          .on('error', reject);
      });
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
    } else if (req.body.emails) {
      // Allow passing emails directly via JSON
      emails.push(...(Array.isArray(req.body.emails) ? req.body.emails : [req.body.emails]));
    }

    if (emails.length === 0) {
      return res.status(400).json({ error: 'No valid emails provided' });
    }

    const scheduledDate = new Date(scheduledAt);
    let baseDelay = scheduledDate.getTime() - Date.now();
    if (baseDelay < 0) baseDelay = 0; // Schedule immediately if past time

    const delayBetween = parseInt(delayMs) || 0;

    const emailRecords = await Promise.all(emails.map(async (toEmail, index) => {
      // Create DB Record
      const record = await prisma.email.create({
        data: {
          userId,
          toEmail,
          subject,
          body,
          scheduledAt: new Date(scheduledDate.getTime() + index * delayBetween),
          status: 'SCHEDULED'
        }
      });

      // Index in ElasticSearch (safe attempt)
      try {
        await esClient.index({
          index: 'emails',
          id: record.id,
          document: {
            id: record.id,
            userId,
            toEmail,
            subject,
            body,
            status: 'SCHEDULED',
            scheduledAt: record.scheduledAt,
          }
        });
      } catch (esErr) {
        console.warn('Elasticsearch indexing skipped (service offline):', esErr);
      }

      // Add to BullMQ with incremental delay
      const job = await emailQueue.add(
        'send-email',
        {
          emailId: record.id,
          userId,
          toEmail,
          subject,
          body,
        },
        {
          delay: baseDelay + (index * delayBetween),
          jobId: record.id, // Idempotency key
        }
      );

      // Update DB with Job ID
      await prisma.email.update({
        where: { id: record.id },
        data: { bullJobId: job.id }
      });

      return record;
    }));

    res.json({ message: 'Emails scheduled successfully', count: emailRecords.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/scheduled', async (req, res) => {
  const { userId } = req.query;
  const emails = await prisma.email.findMany({
    where: { userId: String(userId), status: 'SCHEDULED' },
    orderBy: { scheduledAt: 'asc' }
  });
  res.json(emails);
});

router.get('/sent', async (req, res) => {
  const { userId } = req.query;
  const emails = await prisma.email.findMany({
    where: { userId: String(userId), status: { in: ['SENT', 'FAILED'] } },
    orderBy: { sentAt: 'desc' }
  });
  res.json(emails);
});

router.get('/search', async (req, res) => {
  const { userId, q } = req.query;
  if (!q) return res.json([]);

  try {
    const result = await esClient.search({
      index: 'emails',
      body: {
        query: {
          bool: {
            must: [
              { term: { userId: String(userId) } },
              {
                multi_match: {
                  query: String(q),
                  fields: ['subject', 'toEmail', 'body']
                }
              }
            ]
          }
        }
      }
    });

    const hits = result.hits.hits.map((hit: any) => hit._source);
    res.json(hits);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Elasticsearch query failed' });
  }
});

export default router;
