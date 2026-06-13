import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../app';
import { prismaMock } from '../../test/setup';
import { queueCache } from '../../shared/services/cache.service';
import { aiService } from '../ai/ai.service';

describe('Queue Buffer Endpoint', () => {
  describe('PUT /api/queues/doctors/:doctorId/buffer', () => {
    it('should return 400 if delayBuffer or branchId is missing', async () => {
      const res = await request(app)
        .put('/api/queues/doctors/doc_123/buffer')
        .send({ delayBuffer: 15 });
      
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Please provide delayBuffer and branchId.');
    });

    it('should successfully update doctor buffer and recalculate queue ETAs', async () => {
      // Mock DoctorProfile update
      // @ts-ignore
      prismaMock.doctorProfile.update.mockResolvedValue({ id: 'doc_123', delayBuffer: 20 });

      // Mock active queue tokens in cache
      const mockTokens = [
        {
          id: 'token_1',
          tokenNo: 'GP-001',
          status: 'WAITING',
          estimatedWait: 15,
          branchId: 'branch_abc',
          doctorId: 'doc_123',
          queueOrder: 0,
        },
        {
          id: 'token_2',
          tokenNo: 'GP-002',
          status: 'IN_CONSULTATION', // shouldn't be recalculated
          estimatedWait: 0,
          branchId: 'branch_abc',
          doctorId: 'doc_123',
          queueOrder: 1,
        }
      ];
      // @ts-ignore
      vi.spyOn(queueCache, 'getQueue').mockResolvedValue(mockTokens);
      vi.spyOn(queueCache, 'saveQueue').mockResolvedValue(undefined);

      // Mock AI wait time recalculation
      vi.spyOn(aiService, 'getEstimatedWaitTime').mockResolvedValue(35); // 15m default + 20m buffer

      // Mock token database update
      // @ts-ignore
      prismaMock.token.update.mockResolvedValue({});

      const res = await request(app)
        .put('/api/queues/doctors/doc_123/buffer')
        .send({
          delayBuffer: 20,
          branchId: 'branch_abc'
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Delay buffer updated and ETAs recalculated.');
      expect(res.body.delayBuffer).toBe(20);
      
      // The waiting token should have updated estimatedWait
      const updatedToken1 = res.body.queue.find((t: any) => t.id === 'token_1');
      expect(updatedToken1.estimatedWait).toBe(35);

      // The in-consultation token should NOT have updated estimatedWait (remains 0)
      const updatedToken2 = res.body.queue.find((t: any) => t.id === 'token_2');
      expect(updatedToken2.estimatedWait).toBe(0);

      expect(prismaMock.doctorProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'doc_123' },
          data: { delayBuffer: 20 }
        })
      );
    });
  });
});
