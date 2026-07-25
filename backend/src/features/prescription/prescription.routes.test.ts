import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../app';
import { prismaMock } from '../../test/setup';

const TEST_SECRET = 'test_secret_for_cureq_platform';

function generateAuthHeader(role = 'DOCTOR', userId = 'doc_user_123') {
  const token = jwt.sign({ id: userId, role, email: 'dr@cureq.com' }, TEST_SECRET);
  return `Bearer ${token}`;
}

describe('E-Prescription & Care Workflow API Routes', () => {
  const authHeader = generateAuthHeader();

  describe('POST /api/prescriptions', () => {
    it('should return 400 if required fields are missing', async () => {
      const res = await request(app)
        .post('/api/prescriptions')
        .set('Authorization', authHeader)
        .send({ patientName: 'John Doe' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('tokenId, patientName, doctorId, branchId, and medications are required.');
    });

    it('should create prescription and generate QR code Data URL', async () => {
      const mockPrescription = {
        id: 'rx_999',
        tokenId: 'token_123',
        patientName: 'John Doe',
        patientPhone: '9876543210',
        doctorId: 'doc_1',
        doctorName: 'Dr. Sharma',
        branchId: 'branch_1',
        medications: [{ name: 'Paracetamol', dosage: '500mg', frequency: 'BD', duration: '5 days' }],
        interactions: [],
        generalAdvice: 'Drink plenty of water',
        status: 'DRAFT',
        qrCode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
        qrData: 'http://localhost:3001/queue/token_123',
        createdAt: new Date(),
      };

      // @ts-ignore
      prismaMock.prescription.create.mockResolvedValue(mockPrescription);

      const res = await request(app)
        .post('/api/prescriptions')
        .set('Authorization', authHeader)
        .send({
          tokenId: 'token_123',
          patientName: 'John Doe',
          patientPhone: '9876543210',
          doctorId: 'doc_1',
          doctorName: 'Dr. Sharma',
          branchId: 'branch_1',
          medications: [{ name: 'Paracetamol', dosage: '500mg', frequency: 'BD', duration: '5 days' }],
          generalAdvice: 'Drink plenty of water',
        });

      expect(res.status).toBe(201);
      expect(res.body.prescription.id).toBe('rx_999');
      expect(res.body.qrCode).toContain('data:image/png;base64');
      expect(res.body.trackerUrl).toContain('/queue/token_123');
    });
  });

  describe('POST /api/prescriptions/:prescriptionId/share-whatsapp', () => {
    it('should simulate WhatsApp sharing and update prescription status to SENT', async () => {
      const mockRx = {
        id: 'rx_999',
        tokenId: 'token_123',
        patientName: 'John Doe',
        patientPhone: '9876543210',
        doctorName: 'Dr. Sharma',
        branchId: 'branch_1',
        medications: [{ name: 'Amoxicillin', dosage: '500mg', frequency: 'TDS', duration: '5 days' }],
        generalAdvice: 'Take after meals',
        qrData: 'http://localhost:3001/queue/token_123',
      };

      // @ts-ignore
      prismaMock.prescription.findUnique.mockResolvedValue(mockRx);
      // @ts-ignore
      prismaMock.prescription.update.mockResolvedValue({ ...mockRx, status: 'SENT' });
      // @ts-ignore
      prismaMock.notificationLog.create.mockResolvedValue({ id: 'log_1' });

      const res = await request(app)
        .post('/api/prescriptions/rx_999/share-whatsapp')
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Prescription shared via WhatsApp successfully.');
      expect(res.body.whatsappText).toContain('Amoxicillin');
      expect(res.body.whatsappText).toContain('http://localhost:3001/queue/token_123');
    });
  });

  describe('POST /api/prescriptions/:prescriptionId/pharmacy-order', () => {
    it('should create a pharmacy order and log notification', async () => {
      const mockRx = {
        id: 'rx_999',
        tokenId: 'token_123',
        patientName: 'Jane Smith',
        patientPhone: '9123456789',
        branchId: 'branch_1',
        medications: [{ name: 'Metformin', dosage: '500mg', frequency: 'BD', duration: '30 days' }],
        token: { tokenNo: 'GP-005' },
      };

      // @ts-ignore
      prismaMock.prescription.findUnique.mockResolvedValue(mockRx);
      // @ts-ignore
      prismaMock.pharmacyOrder.findFirst.mockResolvedValue(null);
      // @ts-ignore
      prismaMock.pharmacyOrder.create.mockResolvedValue({
        id: 'p_order_1',
        prescriptionId: 'rx_999',
        branchId: 'branch_1',
        patientName: 'Jane Smith',
        patientPhone: '9123456789',
        tokenNo: 'GP-005',
        status: 'PENDING',
      });

      const res = await request(app)
        .post('/api/prescriptions/rx_999/pharmacy-order')
        .set('Authorization', authHeader);

      expect(res.status).toBe(201);
      expect(res.body.order.id).toBe('p_order_1');
      expect(res.body.message).toBe('Pharmacy order created successfully.');
    });
  });

  describe('POST /api/prescriptions/:prescriptionId/lab-order', () => {
    it('should create a lab order with priority and test items', async () => {
      const mockRx = {
        id: 'rx_999',
        tokenId: 'token_123',
        patientName: 'Alex Mercer',
        patientPhone: '9988776655',
        branchId: 'branch_1',
        token: { tokenNo: 'GP-010' },
      };

      // @ts-ignore
      prismaMock.prescription.findUnique.mockResolvedValue(mockRx);
      // @ts-ignore
      prismaMock.labOrder.create.mockResolvedValue({
        id: 'lab_order_1',
        prescriptionId: 'rx_999',
        branchId: 'branch_1',
        patientName: 'Alex Mercer',
        patientPhone: '9988776655',
        priority: 'URGENT',
        status: 'PENDING',
      });

      const res = await request(app)
        .post('/api/prescriptions/rx_999/lab-order')
        .set('Authorization', authHeader)
        .send({
          tests: [{ testName: 'Complete Blood Count (CBC)', urgency: 'URGENT' }],
          priority: 'URGENT',
        });

      expect(res.status).toBe(201);
      expect(res.body.order.id).toBe('lab_order_1');
      expect(res.body.order.priority).toBe('URGENT');
    });
  });
});
