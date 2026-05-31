import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../../shared/middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

function generateInvoiceNo(date: Date, sequence: number): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `INV-${y}${m}${d}-${String(sequence).padStart(3, '0')}`;
}

/**
 * @route   GET /api/billing/invoice/:id
 * @desc    Get a single invoice by ID
 */
router.get('/invoice/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found.' });
    res.json(invoice);
  } catch (err) {
    console.error('Get invoice error:', err);
    res.status(500).json({ error: 'Failed to fetch invoice.' });
  }
});

/**
 * @route   PUT /api/billing/invoice/:id/pay
 * @desc    Mark invoice as paid
 */
router.put('/invoice/:id/pay', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { paymentMethod } = req.body;
  try {
    const invoice = await prisma.invoice.update({
      where: { id },
      data: {
        status: 'PAID',
        paymentMethod: paymentMethod || 'CASH',
        paidAt: new Date(),
      },
    });
    res.json(invoice);
  } catch (err) {
    console.error('Mark paid error:', err);
    res.status(500).json({ error: 'Failed to update invoice.' });
  }
});

/**
 * @route   PUT /api/billing/invoice/:id/cancel
 * @desc    Cancel an invoice
 */
router.put('/invoice/:id/cancel', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const invoice = await prisma.invoice.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
    res.json(invoice);
  } catch (err) {
    console.error('Cancel invoice error:', err);
    res.status(500).json({ error: 'Failed to cancel invoice.' });
  }
});

/**
 * @route   GET /api/billing/:branchId
 * @desc    List invoices for a branch (optional date filter)
 */
router.get('/:branchId', authenticateToken, async (req, res) => {
  const { branchId } = req.params;
  const { date, status } = req.query;

  try {
    const where: any = { branchId };

    if (date) {
      const dayStart = new Date(`${date}T00:00:00.000Z`);
      const dayEnd = new Date(`${date}T23:59:59.999Z`);
      where.createdAt = { gte: dayStart, lte: dayEnd };
    } else {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      where.createdAt = { gte: todayStart };
    }

    if (status && status !== 'ALL') {
      where.status = status;
    }

    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json(invoices);
  } catch (err) {
    console.error('List invoices error:', err);
    res.status(500).json({ error: 'Failed to fetch invoices.' });
  }
});

/**
 * @route   POST /api/billing/:branchId
 * @desc    Create a new invoice
 */
router.post('/:branchId', authenticateToken, async (req, res) => {
  const { branchId } = req.params;
  const { patientName, patientPhone, patientId, doctorName, doctorId, clinicId, items, discount, tax, notes } = req.body;

  if (!patientName || !patientPhone || !doctorName || !clinicId || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Patient info, doctor, and at least one line item are required.' });
  }

  try {
    const subtotal = items.reduce((sum: number, item: any) => sum + (item.qty * item.unitPrice), 0);
    const discountAmt = discount || 0;
    const taxAmt = tax || 0;
    const total = Math.max(0, subtotal - discountAmt + taxAmt);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayCount = await prisma.invoice.count({ where: { branchId, createdAt: { gte: todayStart } } });
    const invoiceNo = generateInvoiceNo(new Date(), todayCount + 1);

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNo,
        patientName,
        patientPhone,
        patientId: patientId || null,
        doctorName,
        doctorId: doctorId || '',
        branchId,
        clinicId,
        items,
        subtotal,
        discount: discountAmt,
        tax: taxAmt,
        total,
        notes: notes || null,
      },
    });

    res.status(201).json(invoice);
  } catch (err) {
    console.error('Create invoice error:', err);
    res.status(500).json({ error: 'Failed to create invoice.' });
  }
});

export default router;
