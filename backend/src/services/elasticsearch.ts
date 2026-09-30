import { Client } from '@elastic/elasticsearch';
import { config } from '../config';

const esClient = new Client({ node: config.elasticsearchNode });

export const setupElasticsearch = async () => {
  try {
    const exists = await esClient.indices.exists({ index: 'emails' });
    if (!exists) {
      await esClient.indices.create({
        index: 'emails',
        body: {
          mappings: {
            properties: {
              id: { type: 'keyword' },
              userId: { type: 'keyword' },
              toEmail: { type: 'text' },
              subject: { type: 'text' },
              body: { type: 'text' },
              status: { type: 'keyword' },
              scheduledAt: { type: 'date' },
              sentAt: { type: 'date' },
            }
          }
        }
      });
      console.log('Elasticsearch index "emails" created.');
    }
  } catch (error) {
    console.error('Elasticsearch setup error:', error);
  }
};

export default esClient;
