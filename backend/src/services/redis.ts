import Redis from 'ioredis';
import { config } from '../config';

const redisConnection = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  maxRetriesPerRequest: null,
});

export default redisConnection;
