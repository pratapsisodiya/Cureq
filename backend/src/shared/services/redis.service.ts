import { Redis } from 'ioredis';

class RedisService {
  private client: Redis;

  constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
    });

    this.client.on('connect', () => {
      console.log('Connected to Redis successfully');
    });

    this.client.on('error', (err: any) => {
      console.error('Redis connection error:', err);
    });
  }

  /**
   * Get a value from Redis cache
   * @param key Cache key
   * @returns Parsed JSON object or null
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.client.get(key);
      if (data) {
        return JSON.parse(data) as T;
      }
      return null;
    } catch (error) {
      console.error(`Error getting key ${key} from Redis:`, error);
      return null;
    }
  }

  /**
   * Set a value in Redis cache
   * @param key Cache key
   * @param value Value to cache
   * @param expirationSeconds Optional expiration time in seconds
   */
  async set(key: string, value: any, expirationSeconds?: number): Promise<void> {
    try {
      const stringifiedValue = JSON.stringify(value);
      if (expirationSeconds) {
        await this.client.set(key, stringifiedValue, 'EX', expirationSeconds);
      } else {
        await this.client.set(key, stringifiedValue);
      }
    } catch (error) {
      console.error(`Error setting key ${key} in Redis:`, error);
    }
  }

  /**
   * Delete a key from Redis cache
   * @param key Cache key
   */
  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      console.error(`Error deleting key ${key} from Redis:`, error);
    }
  }

  /**
   * Clear all keys matching a pattern
   * @param pattern Pattern to match keys (e.g., 'user:*')
   */
  async clearPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (error) {
      console.error(`Error clearing pattern ${pattern} from Redis:`, error);
    }
  }

  /**
   * Close the Redis connection
   */
  async disconnect(): Promise<void> {
    await this.client.quit();
  }
}

export const redisService = new RedisService();
