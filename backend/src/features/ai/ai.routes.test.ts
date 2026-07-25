import { describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../app';

const TEST_SECRET = 'test_secret_for_cureq_platform';

function generateAuthHeader() {
  const token = jwt.sign({ id: 'doc_1', role: 'DOCTOR' }, TEST_SECRET);
  return `Bearer ${token}`;
}

describe('AI Feature API Routes', () => {
  const authHeader = generateAuthHeader();

  describe('POST /api/ai/check-drug-interactions', () => {
    it('should return 400 if medications is not an array', async () => {
      const res = await request(app)
        .post('/api/ai/check-drug-interactions')
        .set('Authorization', authHeader)
        .send({ medications: 'Aspirin' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('medications must be an array of drug names.');
    });

    it('should detect known drug interactions in fallback mode', async () => {
      const res = await request(app)
        .post('/api/ai/check-drug-interactions')
        .set('Authorization', authHeader)
        .send({ medications: ['Aspirin', 'Ibuprofen'] });

      expect(res.status).toBe(200);
      expect(res.body.hasInteractions).toBe(true);
      expect(res.body.warnings.length).toBeGreaterThan(0);
      expect(res.body.warnings[0].toLowerCase()).toMatch(/aspirin|ibuprofen|bleeding|cardioprotective/);
    });

    it('should return no interactions for safe medication combinations', async () => {
      const res = await request(app)
        .post('/api/ai/check-drug-interactions')
        .set('Authorization', authHeader)
        .send({ medications: ['Paracetamol', 'Vitamin C'] });

      expect(res.status).toBe(200);
      expect(res.body.hasInteractions).toBe(false);
    });
  });

  describe('POST /api/ai/triage', () => {
    it('should correctly classify emergency complaints', async () => {
      const res = await request(app)
        .post('/api/ai/triage')
        .set('Authorization', authHeader)
        .send({ chiefComplaint: 'Severe chest pain and difficulty breathing' });

      expect(res.status).toBe(200);
      expect(res.body.urgency).toBe('EMERGENCY');
    });
  });
});
