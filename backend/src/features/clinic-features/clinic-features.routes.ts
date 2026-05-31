import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireRole } from '../../shared/middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

// ─── AUDIT LOG HELPER ───────────────────────────────────────────────────────
export async function createAuditLog(
  clinicId: string,
  action: string,
  details?: string,
  userId?: string,
  userName?: string,
  userRole?: string
) {
  try {
    await prisma.auditLog.create({
      data: { clinicId, action, details, userId, userName, userRole },
    });
  } catch { /* non-critical */ }
}

// ─── PATIENT RATING ──────────────────────────────────────────────────────────
// POST /api/features/tokens/:tokenId/rate
router.post('/tokens/:tokenId/rate', async (req, res) => {
  const { rating, ratingComment } = req.body;
  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be 1–5.' });
  }
  try {
    // Find the most recent VisitLog for this token's tokenNo
    const token = await prisma.token.findUnique({ where: { id: req.params.tokenId } });
    if (!token) return res.status(404).json({ error: 'Token not found.' });

    // Update the latest visit log for this tokenNo
    const log = await prisma.visitLog.findFirst({
      where: { tokenNo: token.tokenNo },
      orderBy: { createdAt: 'desc' },
    });
    if (log) {
      await prisma.visitLog.update({
        where: { id: log.id },
        data: { rating: parseInt(rating), ratingComment: ratingComment || null },
      });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error saving rating.' });
  }
});

// ─── CONSULTATION FEE ────────────────────────────────────────────────────────
// PUT /api/features/tokens/:tokenId/fee
router.put('/tokens/:tokenId/fee', authenticateToken, async (req, res) => {
  const { fee } = req.body;
  try {
    const token = await prisma.token.update({
      where: { id: req.params.tokenId },
      data: { consultationFee: parseFloat(fee) || null },
    });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: 'Server error updating fee.' });
  }
});

// ─── REVENUE ANALYTICS ───────────────────────────────────────────────────────
// GET /api/features/clinics/:clinicId/revenue
router.get('/clinics/:clinicId/revenue', authenticateToken, async (req, res) => {
  const { clinicId } = req.params;
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - 7);
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [todayTokens, weekTokens, monthTokens] = await Promise.all([
      prisma.token.findMany({
        where: { branch: { clinicId }, createdAt: { gte: startOfToday }, consultationFee: { not: null } },
        select: { consultationFee: true, patientName: true, tokenNo: true, createdAt: true },
      }),
      prisma.token.findMany({
        where: { branch: { clinicId }, createdAt: { gte: startOfWeek }, consultationFee: { not: null } },
        select: { consultationFee: true, createdAt: true },
      }),
      prisma.token.findMany({
        where: { branch: { clinicId }, createdAt: { gte: startOfMonth }, consultationFee: { not: null } },
        select: { consultationFee: true, createdAt: true },
      }),
    ]);

    const sum = (arr: any[]) => arr.reduce((t, x) => t + (x.consultationFee || 0), 0);

    // 7-day daily revenue
    const dailyRevenue = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStr = d.toLocaleDateString('en-US', { weekday: 'short' });
      const dayStart = new Date(d); dayStart.setHours(0,0,0,0);
      const dayEnd = new Date(d); dayEnd.setHours(23,59,59,999);
      const dayTokens = weekTokens.filter(t => {
        const c = new Date(t.createdAt);
        return c >= dayStart && c <= dayEnd;
      });
      dailyRevenue.push({ day: dayStr, revenue: sum(dayTokens) });
    }

    res.json({
      todayRevenue: sum(todayTokens),
      weekRevenue: sum(weekTokens),
      monthRevenue: sum(monthTokens),
      todayTransactions: todayTokens,
      dailyRevenue,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching revenue.' });
  }
});

// ─── CLINIC HOLIDAYS ─────────────────────────────────────────────────────────
// GET /api/features/clinics/:clinicId/holidays
router.get('/clinics/:clinicId/holidays', async (req, res) => {
  try {
    const holidays = await prisma.clinicHoliday.findMany({
      where: { clinicId: req.params.clinicId },
      orderBy: { date: 'asc' },
    });
    res.json({ holidays });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/features/clinics/:clinicId/holidays
router.post('/clinics/:clinicId/holidays', authenticateToken, async (req, res) => {
  const { date, reason } = req.body;
  if (!date) return res.status(400).json({ error: 'Date is required.' });
  try {
    const holiday = await prisma.clinicHoliday.upsert({
      where: { clinicId_date: { clinicId: req.params.clinicId, date } },
      update: { reason: reason || null },
      create: { clinicId: req.params.clinicId, date, reason: reason || null },
    });
    res.json({ holiday });
  } catch (err) {
    res.status(500).json({ error: 'Server error saving holiday.' });
  }
});

// DELETE /api/features/clinics/:clinicId/holidays/:date
router.delete('/clinics/:clinicId/holidays/:date', authenticateToken, async (req, res) => {
  try {
    await prisma.clinicHoliday.deleteMany({
      where: { clinicId: req.params.clinicId, date: req.params.date },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error deleting holiday.' });
  }
});

// ─── DOCTOR UNAVAILABILITY ───────────────────────────────────────────────────
// GET /api/features/clinics/:clinicId/unavailability?date=YYYY-MM-DD
router.get('/clinics/:clinicId/unavailability', async (req, res) => {
  const { date } = req.query;
  try {
    const records = await prisma.doctorUnavailability.findMany({
      where: date ? { doctor: { tokens: { some: { branch: { clinicId: req.params.clinicId } } } }, date: date as string } : { doctor: { tokens: { some: { branch: { clinicId: req.params.clinicId } } } } },
      include: { doctor: { include: { user: { select: { name: true } } } } },
    });
    res.json({ unavailability: records });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/features/doctors/:doctorId/unavailability
router.post('/doctors/:doctorId/unavailability', authenticateToken, async (req, res) => {
  const { date, reason, branchId } = req.body;
  if (!date) return res.status(400).json({ error: 'Date required.' });
  try {
    const record = await prisma.doctorUnavailability.upsert({
      where: { doctorId_date: { doctorId: req.params.doctorId, date } },
      update: { reason: reason || null },
      create: { doctorId: req.params.doctorId, branchId: branchId || '', date, reason: reason || null },
    });
    res.json({ record });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /api/features/doctors/:doctorId/unavailability/:date
router.delete('/doctors/:doctorId/unavailability/:date', authenticateToken, async (req, res) => {
  try {
    await prisma.doctorUnavailability.deleteMany({
      where: { doctorId: req.params.doctorId, date: req.params.date },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// ─── AUDIT LOG ───────────────────────────────────────────────────────────────
// GET /api/features/clinics/:clinicId/audit-logs
router.get('/clinics/:clinicId/audit-logs', authenticateToken, async (req, res) => {
  try {
    const logs = await prisma.auditLog.findMany({
      where: { clinicId: req.params.clinicId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// ─── WAITLIST (Pre-Registration) ─────────────────────────────────────────────
// GET /api/features/clinics/:clinicId/waitlist?date=YYYY-MM-DD
router.get('/clinics/:clinicId/waitlist', authenticateToken, async (req, res) => {
  const { date } = req.query;
  try {
    const entries = await prisma.waitlistEntry.findMany({
      where: {
        branch: { clinicId: req.params.clinicId },
        ...(date ? { targetDate: date as string } : {}),
        status: 'PENDING',
      },
      include: { doctor: { include: { user: { select: { name: true } } } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ entries });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/features/clinics/:clinicId/waitlist  (public — patient signs up)
router.post('/clinics/:clinicId/waitlist', async (req, res) => {
  const { patientName, patientPhone, patientId, doctorId, branchId, targetDate, chiefComplaint } = req.body;
  if (!patientName || !patientPhone || !doctorId || !branchId || !targetDate) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }
  try {
    // Check if already on waitlist for same date+doctor
    const existing = await prisma.waitlistEntry.findFirst({
      where: { patientPhone, doctorId, targetDate, status: 'PENDING' },
    });
    if (existing) return res.status(409).json({ error: 'You are already on the waitlist for this date.' });

    const entry = await prisma.waitlistEntry.create({
      data: { patientName, patientPhone, patientId: patientId || null, doctorId, branchId, targetDate, chiefComplaint: chiefComplaint || null },
    });
    res.status(201).json({ entry });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/features/waitlist/:entryId/convert  (reception converts to queue token)
router.post('/waitlist/:entryId/convert', authenticateToken, async (req, res) => {
  try {
    const entry = await prisma.waitlistEntry.findUnique({ where: { id: req.params.entryId } });
    if (!entry || entry.status !== 'PENDING') return res.status(404).json({ error: 'Entry not found or already processed.' });

    // Mark as converted
    await prisma.waitlistEntry.update({ where: { id: entry.id }, data: { status: 'CONVERTED' } });

    res.json({ success: true, message: 'Waitlist entry marked as converted. Add manually to queue.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// ─── VISIT LOG BY ID (for prescription page) ────────────────────────────────
// GET /api/features/visit-logs/:id
router.get('/visit-logs/:id', async (req, res) => {
  try {
    const log = await prisma.visitLog.findUnique({
      where: { id: req.params.id },
      include: { patient: { select: { name: true, phone: true, age: true, gender: true } } },
    });
    if (!log) return res.status(404).json({ error: 'Visit log not found.' });
    res.json({ log });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// ─── PATIENT PORTAL (lookup by phone) ───────────────────────────────────────
// GET /api/features/patient-portal/:phone
router.get('/patient-portal/:phone', async (req, res) => {
  try {
    const patient = await prisma.user.findFirst({
      where: { phone: req.params.phone, role: 'PATIENT' },
      select: { id: true, name: true, phone: true, age: true, gender: true, bloodGroup: true },
    });
    if (!patient) return res.status(404).json({ error: 'No patient found with this phone number.' });

    const [visitLogs, appointments] = await Promise.all([
      prisma.visitLog.findMany({
        where: { patientId: patient.id },
        orderBy: { date: 'desc' },
        take: 20,
      }),
      prisma.appointment.findMany({
        where: { patientId: patient.id, status: 'BOOKED' },
        include: { doctor: { include: { user: { select: { name: true } } } } },
        orderBy: { date: 'desc' },
        take: 10,
      }),
    ]);

    res.json({ patient, visitLogs, appointments });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

export default router;
