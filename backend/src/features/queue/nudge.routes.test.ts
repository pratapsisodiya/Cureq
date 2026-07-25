import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../app';
import { prismaMock } from '../../test/setup';

describe('WhatsApp Live Sync & Call-to-Door Nudge Engine', () => {
  describe('POST /api/queues/:branchId/nudge/:tokenId', () => {
    it('should increment nudgeCount and send WhatsApp nudge with tracker URL (1st strike)', async () => {
      const mockToken = {
        id: 'tok_101',
        tokenNo: 'GP-003',
        patientName: 'Rahul Verma',
        patientPhone: '9876543210',
        nudgeCount: 0,
        doctorId: 'doc_1',
        doctor: { user: { name: 'Dr. Sharma' } },
      };

      // @ts-ignore
      prismaMock.token.findUnique.mockResolvedValue(mockToken);
      // @ts-ignore
      prismaMock.token.update.mockResolvedValue({ ...mockToken, nudgeCount: 1 });
      // @ts-ignore
      prismaMock.notificationLog.create.mockResolvedValue({ id: 'log_nudge_1' });

      const res = await request(app)
        .post('/api/queues/branch_1/nudge/tok_101')
        .send();

      expect(res.status).toBe(200);
      expect(res.body.nudgeCount).toBe(1);
      expect(res.body.autoEscalated).toBe(false);
      expect(res.body.message).toContain('Nudge 1/3 sent to patient via WhatsApp.');

      // Verify notification log contained live tracker link
      expect(prismaMock.notificationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            channel: 'WHATSAPP',
            message: expect.stringContaining('/queue/tok_101'),
          }),
        })
      );
    });

    it('should auto-escalate token to NO_SHOW on 3rd unacknowledged strike', async () => {
      const mockToken = {
        id: 'tok_102',
        tokenNo: 'GP-004',
        patientName: 'Priya Patel',
        patientPhone: '9112233445',
        nudgeCount: 2, // 3rd strike
        doctorId: 'doc_1',
        doctor: { user: { name: 'Dr. Sharma' } },
      };

      // @ts-ignore
      prismaMock.token.findUnique.mockResolvedValue(mockToken);
      // @ts-ignore
      prismaMock.token.update.mockResolvedValue({ ...mockToken, status: 'NO_SHOW', nudgeCount: 3 });
      // @ts-ignore
      prismaMock.branch.findUnique.mockResolvedValue({ id: 'branch_1', clinicId: 'clinic_1', waitingSeats: 10, clinic: { plan: 'FREE' } });

      const res = await request(app)
        .post('/api/queues/branch_1/nudge/tok_102')
        .send();

      expect(res.status).toBe(200);
      expect(res.body.nudgeCount).toBe(3);
      expect(res.body.autoEscalated).toBe(true);
      expect(res.body.message).toContain('3 strikes - marked No-Show');
    });
  });
});
