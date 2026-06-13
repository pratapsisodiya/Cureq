import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireRole } from '../../shared/middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

/**
 * @route   GET /api/notifications/:branchId
 * @desc    Fetch simulated SMS/WhatsApp notification log history
 */
router.get('/:branchId', authenticateToken, async (req, res) => {
  try {
    const logs = await prisma.notificationLog.findMany({
      where: { branchId: req.params.branchId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ logs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error retrieving notification logs.' });
  }
});

/**
 * @route   POST /api/notifications/broadcast
 * @desc    Send broadcast notifications to all waiting patients
 */
router.post('/broadcast', authenticateToken, requireRole(['CLINIC_ADMIN', 'DOCTOR']), async (req, res) => {
  const { branchId, doctorId, message } = req.body;

  if (!branchId || !doctorId || !message) {
    return res.status(400).json({ error: 'Please provide branchId, doctorId, and broadcast message.' });
  }

  try {
    // 1. Get all waiting patients for this doctor at this branch
    const activeTokens = await prisma.token.findMany({
      where: {
        branchId,
        doctorId,
        status: 'WAITING',
      },
      select: { patientPhone: true, id: true },
    });

    if (activeTokens.length === 0) {
      return res.json({ message: 'No active waiting patients to broadcast to.', count: 0 });
    }

    const io = req.app.get('io');
    const logsToCreate = [];

    for (const token of activeTokens) {
      // Log notification
      logsToCreate.push({
        branchId,
        phone: token.patientPhone,
        message: `[BROADCAST] ${message}`,
        channel: 'WHATSAPP' as const,
        status: 'SENT',
      });

      // Send socket broadcast to individual trackers
      if (io) {
        io.to(`token:${token.id}`).emit('broadcast:alert', { message });
      }
    }

    // Insert logs in bulk
    await prisma.notificationLog.createMany({
      data: logsToCreate,
    });

    res.json({ message: 'Broadcast sent successfully.', count: activeTokens.length });
  } catch (err) {
    console.error('Broadcast error:', err);
    res.status(500).json({ error: 'Server error sending broadcast.' });
  }
});

/**
 * @route   GET /api/notifications/:branchId/announcements
 * @desc    Fetch custom TV ticker announcements for a branch
 */
router.get('/:branchId/announcements', async (req, res) => {
  try {
    const branch = await prisma.branch.findUnique({
      where: { id: req.params.branchId },
      select: { announcements: true },
    });
    if (!branch) return res.status(404).json({ error: 'Branch not found.' });
    const announcements = (branch.announcements as string[] | null) || [];
    res.json({ announcements });
  } catch (err) {
    console.error('Fetch announcements error:', err);
    res.status(500).json({ error: 'Server error fetching announcements.' });
  }
});

/**
 * @route   POST /api/notifications/:branchId/announcements
 * @desc    Save custom TV ticker announcements for a branch
 */
router.post('/:branchId/announcements', authenticateToken, requireRole(['CLINIC_ADMIN']), async (req, res) => {
  const { messages } = req.body;
  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages must be an array of strings.' });
  }
  const cleaned = messages.map((m: any) => String(m).trim()).filter(Boolean).slice(0, 10);
  try {
    const branch = await prisma.branch.update({
      where: { id: req.params.branchId },
      data: { announcements: cleaned },
    });
    res.json({ message: 'Announcements updated.', announcements: branch.announcements });
  } catch (err) {
    console.error('Save announcements error:', err);
    res.status(500).json({ error: 'Server error saving announcements.' });
  }
});

export default router;
