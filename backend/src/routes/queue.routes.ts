import { Router } from 'express';
import { PrismaClient, TokenStatus, TokenType, VisitType, SeatStatus } from '@prisma/client';
import { queueCache } from '../services/cache.service';
import { aiService } from '../services/ai.service';
import { broadcastQueueUpdate, broadcastTokenCalled, broadcastTokenUpdate, broadcastDoctorBreak } from '../sockets/queue.socket';
import { createAuditLog } from './features.routes';

const router = Router();
const prisma = new PrismaClient();

// Helper to get speciality prefix
const getSpecialityPrefix = (spec: string): string => {
  const clean = spec.toUpperCase().trim();
  if (clean.includes('GENERAL') || clean.includes('PHYSICIAN')) return 'GP';
  if (clean.includes('ENT')) return 'ENT';
  if (clean.includes('DERMA')) return 'DERM';
  if (clean.includes('DENT')) return 'DENT';
  if (clean.includes('EYE') || clean.includes('OPHTHAL')) return 'EYE';
  if (clean.includes('GYNE')) return 'GYN';
  if (clean.includes('ORTHO')) return 'ORTHO';
  if (clean.includes('PEDIAT')) return 'PED';
  return 'Q';
};

// Helper to send simulated notifications (logs to console and DB log table)
async function sendNotification(
  branchId: string,
  phone: string,
  message: string,
  channel: 'SMS' | 'WHATSAPP'
) {
  try {
    await prisma.notificationLog.create({
      data: {
        branchId,
        phone,
        message,
        channel,
        status: 'SENT',
      },
    });
    console.log(`[Notification - ${channel}] to ${phone}: "${message}"`);
  } catch (err) {
    console.error('Failed to log simulated notification:', err);
  }
}

// Recalculate estimated wait times for all waiting tokens in a doctor's queue
async function recalculateQueueETAs(branchId: string, doctorId: string, io: any) {
  try {
    const activeTokens = await prisma.token.findMany({
      where: {
        branchId,
        doctorId,
        status: 'WAITING',
      },
      orderBy: { queueOrder: 'asc' },
    });

    const updatedTokens = [];
    for (let i = 0; i < activeTokens.length; i++) {
      const token = activeTokens[i];
      const patientsAhead = i;
      const eta = await aiService.getEstimatedWaitTime(branchId, doctorId, patientsAhead);
      
      const updated = await prisma.token.update({
        where: { id: token.id },
        data: { estimatedWait: eta },
      });
      updatedTokens.push(updated);

      // Notify individual patient tracker
      if (io) {
        broadcastTokenUpdate(io, token.id, {
          status: 'WAITING',
          estimatedWait: eta,
          patientsAhead,
        });
      }
    }

    // Refresh active queue cache
    const currentActive = await prisma.token.findMany({
      where: {
        branchId,
        doctorId,
        status: { in: ['WAITING', 'IN_CONSULTATION'] },
      },
      orderBy: { queueOrder: 'asc' },
    });

    const cachedTokens = currentActive.map(t => ({
      id: t.id,
      tokenNo: t.tokenNo,
      patientName: t.patientName,
      patientPhone: t.patientPhone,
      patientId: t.patientId,
      appointmentId: t.appointmentId,
      type: t.type,
      visitType: t.visitType,
      status: t.status,
      chiefComplaint: t.chiefComplaint,
      notes: t.notes,
      estimatedWait: t.estimatedWait,
      checkInTime: t.checkInTime.toISOString(),
      startTime: t.startTime ? t.startTime.toISOString() : null,
      queueOrder: t.queueOrder,
      seatStatus: t.seatStatus,
    }));

    await queueCache.saveQueue(branchId, doctorId, cachedTokens);

    if (io) {
      broadcastQueueUpdate(io, branchId, doctorId, cachedTokens);
    }
  } catch (err) {
    console.error('Error recalculating queue ETAs:', err);
  }
}

/**
 * Promote waiting-outside patients to seated status if seats are available
 */
export async function promoteWaitingOutsidePatients(branchId: string, io: any) {
  try {
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      include: { clinic: true },
    });
    if (!branch) return;

    // Count currently SEATED patients
    const currentSeatedCount = await prisma.token.count({
      where: {
        branchId,
        status: 'WAITING',
        seatStatus: 'SEATED',
      },
    });

    const freeSeats = branch.waitingSeats - currentSeatedCount;
    if (freeSeats <= 0) return;

    // Find waiting outside patients ordered by queue order
    const outsideTokens = await prisma.token.findMany({
      where: {
        branchId,
        status: 'WAITING',
        seatStatus: 'WAITING_OUTSIDE',
      },
      orderBy: { queueOrder: 'asc' },
      take: freeSeats,
      include: { doctor: { include: { user: true } } },
    });

    if (outsideTokens.length === 0) return;

    const plan = branch.clinic.plan;
    const channel = plan === 'FREE' || plan === 'STARTER' ? 'SMS' : 'WHATSAPP';

    for (const token of outsideTokens) {
      // Update status to SEATED in DB
      await prisma.token.update({
        where: { id: token.id },
        data: { seatStatus: 'SEATED' },
      });

      // Log/Send notification
      await sendNotification(
        branchId,
        token.patientPhone,
        `A seat is now available in the waiting room! Token: ${token.tokenNo}. Doctor: ${token.doctor.user.name}. Please proceed inside.`,
        channel
      );

      // Notify individual patient tracker
      if (io) {
        broadcastTokenUpdate(io, token.id, {
          seatStatus: 'SEATED',
        });
      }
    }

    // Refresh active queue cache for all doctors who had promotions
    const doctorIds = Array.from(new Set(outsideTokens.map(t => t.doctorId)));
    for (const dId of doctorIds) {
      const currentActive = await prisma.token.findMany({
        where: {
          branchId,
          doctorId: dId,
          status: { in: ['WAITING', 'IN_CONSULTATION'] },
        },
        orderBy: { queueOrder: 'asc' },
      });

      const cachedTokens = currentActive.map(t => ({
        id: t.id,
        tokenNo: t.tokenNo,
        patientName: t.patientName,
        patientPhone: t.patientPhone,
        patientId: t.patientId,
        appointmentId: t.appointmentId,
        type: t.type,
        visitType: t.visitType,
        status: t.status,
        chiefComplaint: t.chiefComplaint,
        notes: t.notes,
        estimatedWait: t.estimatedWait,
        checkInTime: t.checkInTime.toISOString(),
        startTime: t.startTime ? t.startTime.toISOString() : null,
        queueOrder: t.queueOrder,
        seatStatus: t.seatStatus,
      }));

      await queueCache.saveQueue(branchId, dId, cachedTokens);

      if (io) {
        broadcastQueueUpdate(io, branchId, dId, cachedTokens);
      }
    }
  } catch (err) {
    console.error('Error promoting waiting outside patients:', err);
  }
}

/**
 * @route   POST /api/queues/:branchId/token
 * @desc    Generate a new Token (Walk-in or check-in)
 */
router.post('/:branchId/token', async (req, res) => {
  const { branchId } = req.params;
  const { doctorId, patientPhone, patientName, type, visitType, chiefComplaint, appointmentId, patientId } = req.body;

  if (!doctorId || !patientPhone || !patientName) {
    return res.status(400).json({ error: 'Missing doctor, patient name, or patient phone.' });
  }

  try {
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      include: { clinic: true },
    });

    if (!branch) {
      return res.status(404).json({ error: 'Branch not found.' });
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    // 1. SaaS plan limit verification
    const dailyTokenCount = await prisma.token.count({
      where: { branchId, createdAt: { gte: startOfDay } },
    });

    const plan = branch.clinic.plan;
    if (plan === 'FREE' && dailyTokenCount >= 50) {
      return res.status(402).json({ error: 'Daily token limit (50/day) reached for Free Plan clinics.' });
    }
    if (plan === 'STARTER' && dailyTokenCount >= 200) {
      return res.status(402).json({ error: 'Daily token limit (200/day) reached for Starter Plan clinics.' });
    }

    // 2. Fetch doctor profile and specialty for prefixing
    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { id: doctorId },
      include: { user: true },
    });

    if (!doctorProfile) {
      return res.status(404).json({ error: 'Doctor profile not found.' });
    }

    const prefix = getSpecialityPrefix(doctorProfile.speciality);

    // Calculate queue sequence for today
    const doctorTokenCountToday = await prisma.token.count({
      where: { doctorId, createdAt: { gte: startOfDay } },
    });

    const queueOrder = doctorTokenCountToday + 1;
    const tokenNo = `${prefix}-${queueOrder.toString().padStart(3, '0')}`;

    // 3. Estimate wait time and determine seating status
    const waitingCount = await prisma.token.count({
      where: { branchId, doctorId, status: 'WAITING' },
    });
    const eta = await aiService.getEstimatedWaitTime(branchId, doctorId, waitingCount);

    const currentSeatedCount = await prisma.token.count({
      where: { branchId, status: 'WAITING', seatStatus: 'SEATED' },
    });

    const seatStatus = currentSeatedCount < branch.waitingSeats ? SeatStatus.SEATED : SeatStatus.WAITING_OUTSIDE;

    // Find the patient user by phone to link patientId
    const patientUser = await prisma.user.findFirst({
      where: { phone: patientPhone, role: 'PATIENT' }
    });

    // 4. Create Token in DB
    const token = await prisma.token.create({
      data: {
        tokenNo,
        queueOrder,
        type: (type as TokenType) || 'GENERAL',
        visitType: (visitType as VisitType) || 'NEW',
        status: 'WAITING',
        chiefComplaint: chiefComplaint || null,
        estimatedWait: eta,
        patientPhone,
        patientName,
        patientId: patientId || (patientUser ? patientUser.id : null),
        doctorId,
        branchId,
        appointmentId: appointmentId || null,
        seatStatus,
      },
    });

    // 5. If converting an appointment, mark appointment checked in
    if (appointmentId) {
      await prisma.appointment.update({
        where: { id: appointmentId },
        data: { status: 'CHECKED_IN' },
      });
    }

    // 6. Push to cache
    const activeTokenCached = {
      id: token.id,
      tokenNo: token.tokenNo,
      patientName: token.patientName,
      patientPhone: token.patientPhone,
      patientId: token.patientId,
      appointmentId: token.appointmentId,
      type: token.type,
      visitType: token.visitType,
      status: token.status,
      chiefComplaint: token.chiefComplaint,
      notes: token.notes,
      estimatedWait: token.estimatedWait,
      checkInTime: token.checkInTime.toISOString(),
      startTime: null,
      queueOrder: token.queueOrder,
      seatStatus: token.seatStatus,
    };

    const io = req.app.get('io');
    await queueCache.addToken(branchId, doctorId, activeTokenCached);

    if (io) {
      const activeQueue = await queueCache.getQueue(branchId, doctorId);
      broadcastQueueUpdate(io, branchId, doctorId, activeQueue);
    }

    // 7. Send notification logs
    const channel = plan === 'FREE' || plan === 'STARTER' ? 'SMS' : 'WHATSAPP';
    const patientsAhead = waitingCount;
    
    const notificationMsg = seatStatus === SeatStatus.SEATED
      ? `You joined the queue! Token: ${tokenNo}. Doctor: ${doctorProfile.user.name}. Please proceed to the waiting area. A seat is allocated. ETA: ~${eta} mins.`
      : `You joined the queue! Token: ${tokenNo}. Doctor: ${doctorProfile.user.name}. The waiting room is full. You are in the virtual queue. We will alert you when a seat is free. ETA: ~${eta} mins.`;

    await sendNotification(
      branchId,
      patientPhone,
      notificationMsg,
      channel
    );

    // Audit log
    await createAuditLog(
      branch.clinicId,
      'TOKEN_CREATED',
      `Token ${tokenNo} created for ${patientName} (Doctor: ${doctorProfile.user.name})`,
    );

    res.status(201).json({ token, patientsAhead });
  } catch (err) {
    console.error('Create token error:', err);
    res.status(500).json({ error: 'Server error generating queue token.' });
  }
});

/**
 * @route   GET /api/queues/:branchId/live
 * @desc    Get live queue data for a doctor at a branch
 */
router.get('/:branchId/live', async (req, res) => {
  const { branchId } = req.params;
  const { doctorId } = req.query;

  if (!doctorId) {
    return res.status(400).json({ error: 'Doctor ID query parameter required.' });
  }

  try {
    // Check cache first
    let cached = await queueCache.getQueue(branchId, doctorId as string);

    if (cached.length === 0) {
      // Rebuild cache from DB
      const dbActive = await prisma.token.findMany({
        where: {
          branchId,
          doctorId: doctorId as string,
          status: { in: ['WAITING', 'IN_CONSULTATION'] },
        },
        orderBy: { queueOrder: 'asc' },
      });

      cached = dbActive.map(t => ({
        id: t.id,
        tokenNo: t.tokenNo,
        patientName: t.patientName,
        patientPhone: t.patientPhone,
        patientId: t.patientId,
        appointmentId: t.appointmentId,
        type: t.type,
        visitType: t.visitType,
        status: t.status,
        chiefComplaint: t.chiefComplaint,
        notes: t.notes,
        estimatedWait: t.estimatedWait,
        checkInTime: t.checkInTime.toISOString(),
        startTime: t.startTime ? t.startTime.toISOString() : null,
        queueOrder: t.queueOrder,
        seatStatus: t.seatStatus,
      }));

      await queueCache.saveQueue(branchId, doctorId as string, cached);
    }

    // Get served, skipped, no-shows from DB for today's dashboard details
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const served = await prisma.token.findMany({
      where: { branchId, doctorId: doctorId as string, status: 'SERVED', createdAt: { gte: startOfDay } },
      orderBy: { queueOrder: 'asc' },
    });

    const skipped = await prisma.token.findMany({
      where: { branchId, doctorId: doctorId as string, status: 'SKIPPED', createdAt: { gte: startOfDay } },
      orderBy: { queueOrder: 'asc' },
    });

    const noshow = await prisma.token.findMany({
      where: { branchId, doctorId: doctorId as string, status: 'NO_SHOW', createdAt: { gte: startOfDay } },
      orderBy: { queueOrder: 'asc' },
    });

    res.json({
      active: cached,
      served,
      skipped,
      noshow,
    });
  } catch (err) {
    console.error('Fetch live queue error:', err);
    res.status(500).json({ error: 'Server error retrieving queue.' });
  }
});

/**
 * @route   POST /api/queues/:branchId/next
 * @desc    Doctor triggers Call Next patient
 */
router.post('/:branchId/next', async (req, res) => {
  const { branchId } = req.params;
  const { doctorId, notes, followUpDate } = req.body;

  if (!doctorId) {
    return res.status(400).json({ error: 'Doctor ID is required.' });
  }

  try {
    const io = req.app.get('io');

    // 1. Auto-serve the current patient IN_CONSULTATION (if any)
    const activeConsult = await prisma.token.findFirst({
      where: { branchId, doctorId, status: 'IN_CONSULTATION' },
    });

    if (activeConsult) {
      await prisma.token.update({
        where: { id: activeConsult.id },
        data: { status: 'SERVED', endTime: new Date() },
      });

      // Add a patient history log
      if (activeConsult.patientId) {
        const doctorProfile = await prisma.doctorProfile.findUnique({
          where: { id: doctorId },
          include: { user: true },
        });

        await prisma.visitLog.create({
          data: {
            tokenNo: activeConsult.tokenNo,
            doctorName: doctorProfile?.user.name || 'Doctor',
            specialty: doctorProfile?.speciality || 'GP',
            chiefComplaint: activeConsult.chiefComplaint || '',
            notes: notes || 'Completed consultation',
            patientId: activeConsult.patientId,
            followUpDate: followUpDate || null,
          },
        });

        // Get clinicId for audit log
        const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { clinicId: true } });
        if (branch) {
          await createAuditLog(
            branch.clinicId,
            'TOKEN_SERVED',
            `Token ${activeConsult.tokenNo} served — Patient: ${activeConsult.patientName} (Dr. ${doctorProfile?.user.name || 'Doctor'})`,
          );
        }
      }
    }

    // 2. Find next WAITING token
    const nextToken = await prisma.token.findFirst({
      where: { branchId, doctorId, status: 'WAITING' },
      orderBy: { queueOrder: 'asc' },
      include: { doctor: { include: { user: true } } },
    });

    if (!nextToken) {
      // Clear cache of active since no one is waiting/active
      await recalculateQueueETAs(branchId, doctorId, io);
      return res.json({ message: 'Queue is empty. No waiting patients.', token: null });
    }

    // 3. Set next patient to IN_CONSULTATION
    const updatedNext = await prisma.token.update({
      where: { id: nextToken.id },
      data: { status: 'IN_CONSULTATION', startTime: new Date() },
    });

    // 3.5 Promote waiting outside patients since a seat just opened up
    await promoteWaitingOutsidePatients(branchId, io);

    // 4. Recalculate other wait times, refresh cache and broadcast updates
    await recalculateQueueETAs(branchId, doctorId, io);

    // 5. Broadcast TV chime
    if (io) {
      broadcastTokenCalled(io, branchId, updatedNext.tokenNo, nextToken.doctor.user.name);
      broadcastTokenUpdate(io, updatedNext.id, { status: 'IN_CONSULTATION', patientsAhead: 0, estimatedWait: 0, startTime: new Date().toISOString() });
    }

    // 6. Send SMS/WhatsApp
    await sendNotification(
      branchId,
      updatedNext.patientPhone,
      `Your token ${updatedNext.tokenNo} is called! Please proceed to Dr. ${nextToken.doctor.user.name}'s chamber now.`,
      'WHATSAPP'
    );

    // Notify the patient who is now 2 ahead
    const twoAheadToken = await prisma.token.findFirst({
      where: { branchId, doctorId, status: 'WAITING' },
      orderBy: { queueOrder: 'asc' },
      skip: 1, // index 1 is 2 ahead (the 1st waiting is 1 ahead)
    });

    if (twoAheadToken) {
      await sendNotification(
        branchId,
        twoAheadToken.patientPhone,
        `Your turn is approaching! Token ${twoAheadToken.tokenNo} is 2 patients away. Please return to the clinic waiting area.`,
        'SMS'
      );
    }

    res.json({ message: 'Next patient called successfully.', token: updatedNext });
  } catch (err) {
    console.error('Call next error:', err);
    res.status(500).json({ error: 'Server error calling next patient.' });
  }
});

/**
 * @route   POST /api/queues/:branchId/skip
 * @desc    Skip the active/called patient
 */
router.post('/:branchId/skip', async (req, res) => {
  const { branchId } = req.params;
  const { tokenId, doctorId } = req.body;

  try {
    const skippedToken = await prisma.token.update({
      where: { id: tokenId },
      data: { status: 'SKIPPED' },
    });

    const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { clinicId: true } });
    if (branch) {
      await createAuditLog(branch.clinicId, 'TOKEN_SKIPPED', `Token ${skippedToken.tokenNo} skipped — ${skippedToken.patientName}`);
    }

    const io = req.app.get('io');
    await promoteWaitingOutsidePatients(branchId, io);
    await recalculateQueueETAs(branchId, doctorId, io);
    res.json({ message: 'Patient skipped successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error skipping patient.' });
  }
});

/**
 * @route   POST /api/queues/:branchId/recall
 * @desc    Recall patient (TV chime trigger)
 */
router.post('/:branchId/recall', async (req, res) => {
  const { branchId } = req.params;
  const { tokenNo, doctorName } = req.body;

  try {
    const io = req.app.get('io');
    if (io) {
      broadcastTokenCalled(io, branchId, tokenNo, doctorName);
    }
    res.json({ message: 'Recall signal broadcasted.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error recalling patient.' });
  }
});

/**
 * @route   POST /api/queues/:branchId/noshow
 * @desc    Mark patient no-show
 */
router.post('/:branchId/noshow', async (req, res) => {
  const { branchId } = req.params;
  const { tokenId, doctorId } = req.body;

  try {
    const noShowToken = await prisma.token.update({
      where: { id: tokenId },
      data: { status: 'NO_SHOW' },
    });

    const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { clinicId: true } });
    if (branch) {
      await createAuditLog(branch.clinicId, 'TOKEN_NO_SHOW', `Token ${noShowToken.tokenNo} — No-Show: ${noShowToken.patientName}`);
    }

    const io = req.app.get('io');
    await promoteWaitingOutsidePatients(branchId, io);
    await recalculateQueueETAs(branchId, doctorId, io);
    res.json({ message: 'Patient marked as No-Show.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

/**
 * @route   POST /api/queues/:branchId/reorder
 * @desc    Reorder queue tokens manually (drag to change priority)
 */
router.post('/:branchId/reorder', async (req, res) => {
  const { branchId } = req.params;
  const { doctorId, tokenIds } = req.body;

  if (!doctorId || !Array.isArray(tokenIds)) {
    return res.status(400).json({ error: 'Missing doctorId or tokenIds array.' });
  }

  try {
    // 1. Transactionally update ordering indices in database
    await prisma.$transaction(
      tokenIds.map((id, index) =>
        prisma.token.update({
          where: { id },
          data: { queueOrder: index },
        })
      )
    );

    // 2. Recalculate wait times and broadcast
    const io = req.app.get('io');
    await recalculateQueueETAs(branchId, doctorId, io);

    res.json({ message: 'Queue reordered successfully.' });
  } catch (err) {
    console.error('Reorder queue error:', err);
    res.status(500).json({ error: 'Server error reordering queue.' });
  }
});

/**
 * @route   GET /api/queues/token/:tokenId
 * @desc    Public status API for a patient tracker screen
 */
router.get('/token/:tokenId', async (req, res) => {
  try {
    const token = await prisma.token.findUnique({
      where: { id: req.params.tokenId },
      include: {
        branch: { include: { clinic: true } },
        doctor: { include: { user: true } },
      },
    });

    if (!token) {
      return res.status(404).json({ error: 'Token not found.' });
    }

    // Calculate how many patients are ahead of this one
    let patientsAhead = 0;
    let currentlyServing: any = null;

    if (token.status === 'WAITING') {
      patientsAhead = await prisma.token.count({
        where: {
          branchId: token.branchId,
          doctorId: token.doctorId,
          status: 'WAITING',
          queueOrder: { lt: token.queueOrder },
        },
      });

      currentlyServing = await prisma.token.findFirst({
        where: {
          branchId: token.branchId,
          doctorId: token.doctorId,
          status: 'IN_CONSULTATION',
        },
        select: { tokenNo: true },
      });
    }

    res.json({
      token,
      patientsAhead,
      currentlyServingToken: currentlyServing ? currentlyServing.tokenNo : 'None',
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error retrieving tracker details.' });
  }
});

/**
 * @route   POST /api/queues/token/:tokenId/on-my-way
 * @desc    Mark patient "On My Way" (virtual queue activation)
 */
router.post('/token/:tokenId/on-my-way', async (req, res) => {
  try {
    const token = await prisma.token.update({
      where: { id: req.params.tokenId },
      data: { chiefComplaint: `[VIRTUAL CHECK-IN: ON MY WAY] ${req.body.complaint || ''}`.trim() },
    });
    
    // Broadcast updates
    const io = req.app.get('io');
    if (io) {
      const activeQueue = await queueCache.getQueue(token.branchId, token.doctorId);
      // Find and update status in cache
      const cachedTok = activeQueue.find(t => t.id === token.id);
      if (cachedTok) {
        cachedTok.chiefComplaint = token.chiefComplaint;
        await queueCache.saveQueue(token.branchId, token.doctorId, activeQueue);
        broadcastQueueUpdate(io, token.branchId, token.doctorId, activeQueue);
      }
    }

    res.json({ message: 'Status updated. Clinic receptionist notified that you are on your way.', token });
  } catch (err) {
    res.status(500).json({ error: 'Server error activating virtual check-in.' });
  }
});

/**
 * @route   PUT /api/queues/:branchId/break
 * @desc    Doctor toggles break mode — broadcasts to TV displays and reception
 */
router.put('/:branchId/break', async (req, res) => {
  const { branchId } = req.params;
  const { doctorId, doctorName, onBreak, resumeAt } = req.body;

  if (!doctorId || !doctorName) {
    return res.status(400).json({ error: 'doctorId and doctorName are required.' });
  }

  try {
    const io = req.app.get('io');
    if (io) {
      broadcastDoctorBreak(io, branchId, doctorId, doctorName, !!onBreak, resumeAt || null);
    }
    res.json({ success: true, onBreak: !!onBreak });
  } catch (err) {
    res.status(500).json({ error: 'Server error broadcasting break status.' });
  }
});

export default router;
