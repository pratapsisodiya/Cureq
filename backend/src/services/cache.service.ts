import { Token, TokenStatus } from '@prisma/client';

export interface ActiveQueueToken {
  id: string;
  tokenNo: string;
  patientName: string;
  patientPhone: string;
  type: string;
  visitType: string;
  status: TokenStatus;
  chiefComplaint: string | null;
  estimatedWait: number;
  checkInTime: string;
  queueOrder: number;
}

export class QueueCacheService {
  private inMemoryCache = new Map<string, ActiveQueueToken[]>();
  private redisClient: any = null;
  private isUsingRedis = false;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      try {
        // Dynamic import to avoid missing module errors if ioredis isn't installed
        const Redis = require('ioredis');
        this.redisClient = new Redis(redisUrl);
        this.isUsingRedis = true;
        console.log('📶 Redis queue cache initialized successfully.');
      } catch (err) {
        console.warn('⚠️ Failed to load ioredis, falling back to In-Memory Queue cache.', err);
      }
    } else {
      console.log('ℹ️ REDIS_URL not configured. Operating with In-Memory Queue cache.');
    }
  }

  private getQueueKey(branchId: string, doctorId: string): string {
    return `queue:${branchId}:${doctorId}`;
  }

  /**
   * Get active queue tokens for a doctor at a specific branch
   */
  async getQueue(branchId: string, doctorId: string): Promise<ActiveQueueToken[]> {
    const key = this.getQueueKey(branchId, doctorId);
    if (this.isUsingRedis && this.redisClient) {
      try {
        const raw = await this.redisClient.get(key);
        return raw ? JSON.parse(raw) : [];
      } catch (err) {
        console.error('Redis getQueue error, falling back to local memory:', err);
      }
    }
    return this.inMemoryCache.get(key) || [];
  }

  /**
   * Save the active queue state
   */
  async saveQueue(branchId: string, doctorId: string, queue: ActiveQueueToken[]): Promise<void> {
    const key = this.getQueueKey(branchId, doctorId);
    // Sort queue by queueOrder to maintain consistency
    queue.sort((a, b) => a.queueOrder - b.queueOrder);
    
    if (this.isUsingRedis && this.redisClient) {
      try {
        // Set queue with a 24-hour expiration (86400 seconds) since queues reset daily
        await this.redisClient.set(key, JSON.stringify(queue), 'EX', 86400);
        return;
      } catch (err) {
        console.error('Redis saveQueue error, falling back to local memory:', err);
      }
    }
    this.inMemoryCache.set(key, queue);
  }

  /**
   * Add a token to the queue
   */
  async addToken(branchId: string, doctorId: string, token: ActiveQueueToken): Promise<ActiveQueueToken[]> {
    const queue = await this.getQueue(branchId, doctorId);
    queue.push(token);
    await this.saveQueue(branchId, doctorId, queue);
    return queue;
  }

  /**
   * Update the status of a token in the queue
   */
  async updateTokenStatus(branchId: string, doctorId: string, tokenId: string, status: TokenStatus): Promise<ActiveQueueToken[]> {
    const queue = await this.getQueue(branchId, doctorId);
    const token = queue.find(t => t.id === tokenId);
    if (token) {
      token.status = status;
      await this.saveQueue(branchId, doctorId, queue);
    }
    return queue;
  }

  /**
   * Reorder active tokens in the queue
   */
  async reorderQueue(branchId: string, doctorId: string, tokenIds: string[]): Promise<ActiveQueueToken[]> {
    const queue = await this.getQueue(branchId, doctorId);
    const reorderedQueue: ActiveQueueToken[] = [];
    
    tokenIds.forEach((id, index) => {
      const token = queue.find(t => t.id === id);
      if (token) {
        token.queueOrder = index;
        reorderedQueue.push(token);
      }
    });

    // Add any tokens that were in the original queue but missing from the list (to prevent losing tokens)
    queue.forEach(token => {
      if (!reorderedQueue.some(t => t.id === token.id)) {
        token.queueOrder = reorderedQueue.length;
        reorderedQueue.push(token);
      }
    });

    await this.saveQueue(branchId, doctorId, reorderedQueue);
    return reorderedQueue;
  }

  /**
   * Clear the active queue cache (e.g. at the end of the day or reset)
   */
  async clearQueue(branchId: string, doctorId: string): Promise<void> {
    const key = this.getQueueKey(branchId, doctorId);
    if (this.isUsingRedis && this.redisClient) {
      try {
        await this.redisClient.del(key);
        return;
      } catch (err) {
        console.error('Redis clearQueue error:', err);
      }
    }
    this.inMemoryCache.delete(key);
  }
}

export const queueCache = new QueueCacheService();
