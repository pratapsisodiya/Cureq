import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../app';
import { prismaMock } from '../../test/setup';
import { verifyPlanLimits } from './clinic.routes';

describe('Clinic Routes & Utilities', () => {
  describe('verifyPlanLimits utility', () => {
    it('should allow branches on CHAIN subscription plan', async () => {
      // Mock clinic configuration
      const mockClinic = {
        id: 'clinic_123',
        name: 'Super Clinic',
        adminId: 'admin_1',
        plan: 'CHAIN',
        branches: [{ id: 'branch_1' }, { id: 'branch_2' }],
      };
      // @ts-ignore
      prismaMock.clinic.findUnique.mockResolvedValue(mockClinic);

      const result = await verifyPlanLimits('clinic_123', 'branches');
      expect(result.allowed).toBe(true);
    });

    it('should reject extra branches on FREE subscription plan', async () => {
      const mockClinic = {
        id: 'clinic_123',
        name: 'Free Clinic',
        adminId: 'admin_1',
        plan: 'FREE',
        branches: [{ id: 'branch_1' }],
      };
      // @ts-ignore
      prismaMock.clinic.findUnique.mockResolvedValue(mockClinic);

      const result = await verifyPlanLimits('clinic_123', 'branches');
      expect(result.allowed).toBe(false);
      expect(result.message).toContain('only supports 1 clinic branch');
    });

    it('should allow doctors limit under plan caps', async () => {
      const mockClinic = {
        id: 'clinic_123',
        name: 'Starter Clinic',
        adminId: 'admin_1',
        plan: 'STARTER',
        branches: [
          {
            id: 'branch_1',
            schedules: [{ doctorId: 'doc_1' }, { doctorId: 'doc_2' }],
          },
        ],
      };
      // @ts-ignore
      prismaMock.clinic.findUnique.mockResolvedValue(mockClinic);

      const result = await verifyPlanLimits('clinic_123', 'doctors');
      expect(result.allowed).toBe(true);
    });

    it('should reject extra doctors on STARTER subscription plan if count >= 3', async () => {
      const mockClinic = {
        id: 'clinic_123',
        name: 'Starter Clinic',
        adminId: 'admin_1',
        plan: 'STARTER',
        branches: [
          {
            id: 'branch_1',
            schedules: [
              { doctorId: 'doc_1' },
              { doctorId: 'doc_2' },
              { doctorId: 'doc_3' },
            ],
          },
        ],
      };
      // @ts-ignore
      prismaMock.clinic.findUnique.mockResolvedValue(mockClinic);

      const result = await verifyPlanLimits('clinic_123', 'doctors');
      expect(result.allowed).toBe(false);
      expect(result.message).toContain('Starter plan is limited to 3 Doctors');
    });
  });

  describe('GET /api/clinics/:id', () => {
    it('should return 404 if clinic is not found', async () => {
      prismaMock.clinic.findUnique.mockResolvedValue(null);

      const res = await request(app).get('/api/clinics/nonexistent');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Clinic not found.');
    });

    it('should return 200 and clinic details if clinic is found', async () => {
      const mockClinic = {
        id: 'clinic_123',
        name: 'My Clinic',
        adminId: 'admin_1',
        plan: 'FREE',
        branches: [],
      };
      // @ts-ignore
      prismaMock.clinic.findUnique.mockResolvedValue(mockClinic);

      const res = await request(app).get('/api/clinics/clinic_123');
      expect(res.status).toBe(200);
      expect(res.body.clinic).toEqual(mockClinic);
    });
  });
});
