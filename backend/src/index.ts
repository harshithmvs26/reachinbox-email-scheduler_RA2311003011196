import express from 'express';
import cors from 'cors';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

import { config } from './config';
import { emailQueue } from './services/queue';
import { setupElasticsearch } from './services/elasticsearch';
import emailRoutes from './routes/email.routes';
import slackRoutes from './routes/slack.routes';
import authRoutes from './routes/auth.routes';

const app = express();

app.use(cors());
app.use(express.json());

// Setup Bull Board
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');
createBullBoard({
  queues: [new BullMQAdapter(emailQueue) as any],
  serverAdapter,
});

app.use('/admin/queues', serverAdapter.getRouter());

app.use('/api/emails', emailRoutes);
app.use('/api/slack', slackRoutes);
app.use('/api/auth', authRoutes);

app.get('/health', (req, res) => {
  res.send('OK');
});

const startServer = async () => {
  await setupElasticsearch();
  
  if (process.env.RUN_WORKER !== 'false') {
    import('./worker').then(() => console.log('Worker attached to server process.'));
  }
  
  app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
    console.log(`BullMQ dashboard available at http://localhost:${config.port}/admin/queues`);
  });
};

startServer();
