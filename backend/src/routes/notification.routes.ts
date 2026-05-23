import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';

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

export default router;
