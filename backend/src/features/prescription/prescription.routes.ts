import { Router } from 'express';
import { PrismaClient, PrescriptionStatus } from '@prisma/client';
import { authenticateToken } from '../../shared/middleware/auth.middleware';
import QRCode from 'qrcode';

const router = Router();
const prisma = new PrismaClient();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';

/**
 * Helper: Log a WhatsApp/SMS notification
 */
async function logNotification(branchId: string, phone: string, message: string, channel: 'SMS' | 'WHATSAPP') {
  try {
    await prisma.notificationLog.create({
      data: { branchId, phone, message, channel, status: 'SENT' },
    });
    console.log(`[${channel}] → ${phone}: "${message}"`);
  } catch (err) {
    console.error('Notification log error:', err);
  }
}

/**
 * @route   POST /api/prescriptions
 * @desc    Save a finalized AI prescription, generate QR code, link to token/visit
 */
router.post('/', authenticateToken, async (req, res) => {
  const {
    tokenId,
    patientId,
    patientName,
    patientPhone,
    patientAge,
    patientGender,
    doctorId,
    doctorName,
    branchId,
    clinicName,
    medications,
    interactions,
    generalAdvice,
    reviewRequired,
    visitLogId,
  } = req.body;

  if (!tokenId || !patientName || !doctorId || !branchId || !medications) {
    return res.status(400).json({ error: 'tokenId, patientName, doctorId, branchId, and medications are required.' });
  }

  try {
    // Generate QR code pointing to the patient's live queue tracker
    const trackerUrl = `${FRONTEND_URL}/queue/${tokenId}`;
    const qrCodeDataUrl = await QRCode.toDataURL(trackerUrl, {
      width: 200,
      margin: 1,
      color: { dark: '#01696f', light: '#ffffff' },
    });

    const prescription = await prisma.prescription.create({
      data: {
        tokenId,
        visitLogId: visitLogId || null,
        patientId: patientId || null,
        patientName,
        patientPhone,
        patientAge: patientAge ? parseInt(patientAge) : null,
        patientGender: patientGender || null,
        doctorId,
        doctorName,
        branchId,
        clinicName: clinicName || null,
        medications: medications,
        interactions: interactions || [],
        generalAdvice: generalAdvice || null,
        reviewRequired: reviewRequired || false,
        qrCode: qrCodeDataUrl,
        qrData: trackerUrl,
        status: PrescriptionStatus.DRAFT,
      },
    });

    res.status(201).json({ prescription, qrCode: qrCodeDataUrl, trackerUrl });
  } catch (err) {
    console.error('Save prescription error:', err);
    res.status(500).json({ error: 'Failed to save prescription.' });
  }
});

/**
 * @route   GET /api/prescriptions/:prescriptionId
 * @desc    Fetch a single prescription with QR code and orders
 */
router.get('/:prescriptionId', async (req, res) => {
  try {
    const prescription = await prisma.prescription.findUnique({
      where: { id: req.params.prescriptionId },
      include: {
        pharmacyOrders: true,
        labOrders: true,
      },
    });
    if (!prescription) return res.status(404).json({ error: 'Prescription not found.' });
    res.json({ prescription });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch prescription.' });
  }
});

/**
 * @route   GET /api/prescriptions/patient/:patientId
 * @desc    Get all prescriptions for a patient
 */
router.get('/patient/:patientId', authenticateToken, async (req, res) => {
  try {
    const prescriptions = await prisma.prescription.findMany({
      where: { patientId: req.params.patientId },
      orderBy: { createdAt: 'desc' },
      include: { pharmacyOrders: true, labOrders: true },
    });
    res.json({ prescriptions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch patient prescriptions.' });
  }
});

/**
 * @route   GET /api/prescriptions/token/:tokenId
 * @desc    Get prescription(s) linked to a token (for patient tracker page)
 */
router.get('/token/:tokenId', async (req, res) => {
  try {
    const prescriptions = await prisma.prescription.findMany({
      where: { tokenId: req.params.tokenId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ prescriptions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch token prescriptions.' });
  }
});

/**
 * @route   POST /api/prescriptions/:prescriptionId/share-whatsapp
 * @desc    Simulate sending prescription summary + tracker link via WhatsApp
 */
router.post('/:prescriptionId/share-whatsapp', authenticateToken, async (req, res) => {
  try {
    const prescription = await prisma.prescription.findUnique({
      where: { id: req.params.prescriptionId },
    });
    if (!prescription) return res.status(404).json({ error: 'Prescription not found.' });

    const trackerUrl = prescription.qrData || `${FRONTEND_URL}/queue/${prescription.tokenId}`;
    const meds = (prescription.medications as any[]) || [];
    const medLines = meds.slice(0, 4).map((m: any) =>
      `• ${m.name} ${m.dosage} — ${m.frequency} for ${m.duration}`
    ).join('\n');

    const message =
      `💊 *Prescription from Dr. ${prescription.doctorName}*\n\n` +
      `Patient: ${prescription.patientName}\n` +
      `Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}\n\n` +
      `*Medications:*\n${medLines}\n\n` +
      (prescription.generalAdvice ? `*Advice:* ${prescription.generalAdvice}\n\n` : '') +
      `🔗 View & track your prescription:\n${trackerUrl}\n\n` +
      `_Powered by CureQ_`;

    // Update prescription status and timestamp
    await prisma.prescription.update({
      where: { id: req.params.prescriptionId },
      data: { status: PrescriptionStatus.SENT, whatsappSentAt: new Date() },
    });

    await logNotification(prescription.branchId, prescription.patientPhone, message, 'WHATSAPP');

    res.json({
      message: 'Prescription shared via WhatsApp successfully.',
      sentAt: new Date(),
      whatsappText: message,
    });
  } catch (err) {
    console.error('WhatsApp prescription share error:', err);
    res.status(500).json({ error: 'Failed to share prescription via WhatsApp.' });
  }
});

/**
 * @route   POST /api/prescriptions/:prescriptionId/pharmacy-order
 * @desc    Push prescription to pharmacy counter queue
 */
router.post('/:prescriptionId/pharmacy-order', authenticateToken, async (req, res) => {
  const { specialNotes } = req.body;

  try {
    const prescription = await prisma.prescription.findUnique({
      where: { id: req.params.prescriptionId },
      include: { token: { select: { tokenNo: true } } },
    });
    if (!prescription) return res.status(404).json({ error: 'Prescription not found.' });

    // Check if pharmacy order already exists
    const existing = await prisma.pharmacyOrder.findFirst({
      where: { prescriptionId: req.params.prescriptionId },
    });
    if (existing) {
      return res.json({ order: existing, message: 'Pharmacy order already exists.', alreadyExists: true });
    }

    const meds = (prescription.medications as any[]) || [];
    const items = meds.map((m: any) => ({
      name: m.name,
      dosage: m.dosage,
      frequency: m.frequency,
      duration: m.duration,
      qty: m.duration || '1 course',
    }));

    const order = await prisma.pharmacyOrder.create({
      data: {
        prescriptionId: prescription.id,
        branchId: prescription.branchId,
        patientName: prescription.patientName,
        patientPhone: prescription.patientPhone,
        tokenNo: prescription.token?.tokenNo || null,
        items,
        specialNotes: specialNotes || null,
        status: 'PENDING',
      },
    });

    // Broadcast to pharmacy dashboard via socket
    const io = req.app.get('io');
    if (io) {
      io.to(`branch:${prescription.branchId}`).emit('pharmacy:new-order', { order });
    }

    await logNotification(
      prescription.branchId,
      prescription.patientPhone,
      `💊 Your prescription has been sent to the pharmacy counter. Token: ${prescription.token?.tokenNo || 'N/A'}. Please collect your medicines from the pharmacy.`,
      'WHATSAPP'
    );

    res.status(201).json({ order, message: 'Pharmacy order created successfully.' });
  } catch (err) {
    console.error('Pharmacy order error:', err);
    res.status(500).json({ error: 'Failed to create pharmacy order.' });
  }
});

/**
 * @route   POST /api/prescriptions/:prescriptionId/lab-order
 * @desc    Push prescription to lab with specified tests
 */
router.post('/:prescriptionId/lab-order', authenticateToken, async (req, res) => {
  const { tests, specialNotes, priority } = req.body;

  if (!tests || !Array.isArray(tests) || tests.length === 0) {
    return res.status(400).json({ error: 'tests array is required for lab orders.' });
  }

  try {
    const prescription = await prisma.prescription.findUnique({
      where: { id: req.params.prescriptionId },
      include: { token: { select: { tokenNo: true } } },
    });
    if (!prescription) return res.status(404).json({ error: 'Prescription not found.' });

    const order = await prisma.labOrder.create({
      data: {
        prescriptionId: prescription.id,
        branchId: prescription.branchId,
        patientName: prescription.patientName,
        patientPhone: prescription.patientPhone,
        tokenNo: prescription.token?.tokenNo || null,
        tests,
        specialNotes: specialNotes || null,
        priority: priority || 'NORMAL',
        status: 'PENDING',
      },
    });

    // Broadcast to lab dashboard
    const io = req.app.get('io');
    if (io) {
      io.to(`branch:${prescription.branchId}`).emit('lab:new-order', { order });
    }

    await logNotification(
      prescription.branchId,
      prescription.patientPhone,
      `🧪 Lab tests have been ordered for you. Please proceed to the lab counter with Token: ${prescription.token?.tokenNo || 'N/A'}. Priority: ${priority || 'NORMAL'}.`,
      'WHATSAPP'
    );

    res.status(201).json({ order, message: 'Lab order created successfully.' });
  } catch (err) {
    console.error('Lab order error:', err);
    res.status(500).json({ error: 'Failed to create lab order.' });
  }
});

/**
 * @route   GET /api/prescriptions/orders/pharmacy/:branchId
 * @desc    Get all pharmacy orders for a branch (pharmacy dashboard)
 */
router.get('/orders/pharmacy/:branchId', authenticateToken, async (req, res) => {
  const { status } = req.query;
  try {
    const where: any = { branchId: req.params.branchId };
    if (status && status !== 'ALL') where.status = status as string;

    const orders = await prisma.pharmacyOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        prescription: { select: { doctorName: true, qrData: true, generalAdvice: true } },
      },
    });
    res.json({ orders });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pharmacy orders.' });
  }
});

/**
 * @route   PUT /api/prescriptions/orders/pharmacy/:orderId/status
 * @desc    Update pharmacy order status
 */
router.put('/orders/pharmacy/:orderId/status', authenticateToken, async (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'status is required.' });

  try {
    const order = await prisma.pharmacyOrder.update({
      where: { id: req.params.orderId },
      data: {
        status: status as any,
        dispensedAt: status === 'DISPENSED' ? new Date() : undefined,
      },
    });

    // Notify patient when medicines are ready
    if (status === 'READY' || status === 'DISPENSED') {
      const msg = status === 'READY'
        ? `✅ Your medicines are ready at the pharmacy counter! Token: ${order.tokenNo || 'N/A'}. Please collect now.`
        : `✅ Medicines dispensed successfully. Get well soon!`;
      await logNotification(order.branchId, order.patientPhone, msg, 'WHATSAPP');
    }

    // Broadcast update
    const io = req.app.get('io');
    if (io) io.to(`branch:${order.branchId}`).emit('pharmacy:order-updated', { order });

    res.json({ order, message: 'Pharmacy order status updated.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update pharmacy order.' });
  }
});

/**
 * @route   GET /api/prescriptions/orders/lab/:branchId
 * @desc    Get all lab orders for a branch (lab dashboard)
 */
router.get('/orders/lab/:branchId', authenticateToken, async (req, res) => {
  const { status } = req.query;
  try {
    const where: any = { branchId: req.params.branchId };
    if (status && status !== 'ALL') where.status = status as string;

    const orders = await prisma.labOrder.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      take: 100,
      include: {
        prescription: { select: { doctorName: true, qrData: true } },
      },
    });
    res.json({ orders });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch lab orders.' });
  }
});

/**
 * @route   PUT /api/prescriptions/orders/lab/:orderId/status
 * @desc    Update lab order status
 */
router.put('/orders/lab/:orderId/status', authenticateToken, async (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'status is required.' });

  try {
    const order = await prisma.labOrder.update({
      where: { id: req.params.orderId },
      data: {
        status: status as any,
        reportReadyAt: status === 'REPORT_READY' ? new Date() : undefined,
      },
    });

    // Notify patient when report is ready
    if (status === 'REPORT_READY') {
      await logNotification(
        order.branchId,
        order.patientPhone,
        `🧪 Your lab report is ready! Token: ${order.tokenNo || 'N/A'}. Please collect your report from the lab counter or ask the receptionist.`,
        'WHATSAPP'
      );
    }

    const io = req.app.get('io');
    if (io) io.to(`branch:${order.branchId}`).emit('lab:order-updated', { order });

    res.json({ order, message: 'Lab order status updated.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update lab order.' });
  }
});

export default router;
