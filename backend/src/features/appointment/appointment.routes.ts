import { Router } from 'express';
import { PrismaClient, AppointmentStatus, VisitType } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Helper to generate list of timeslots for a doctor's schedule on a specific date
async function getAvailableSlotsForDate(doctorId: string, branchId: string, dateStr: string) {
  const dateObj = new Date(dateStr);
  const dayOfWeek = dateObj.getDay();

  // Find schedule config
  const schedule = await prisma.doctorSchedule.findUnique({
    where: {
      doctorId_branchId_dayOfWeek: {
        doctorId,
        branchId,
        dayOfWeek,
      },
    },
  });

  if (!schedule || !schedule.active) {
    return [];
  }

  // Parse start/end times
  const [startHour, startMin] = schedule.startTime.split(':').map(Number);
  const [endHour, endMin] = schedule.endTime.split(':').map(Number);

  const startMins = startHour * 60 + startMin;
  const endMins = endHour * 60 + endMin;

  const slots = [];
  const duration = schedule.slotDuration;
  const buffer = schedule.bufferTime;

  // Get booked appointments on this date to mark slots taken
  const booked = await prisma.appointment.findMany({
    where: {
      doctorId,
      branchId,
      date: dateStr,
      status: 'BOOKED',
    },
    select: {
      timeSlot: true,
    },
  });

  const bookedSlots = booked.map(b => b.timeSlot);

  let currentMins = startMins;
  while (currentMins + duration <= endMins) {
    const hr = Math.floor(currentMins / 60);
    const mn = currentMins % 60;
    const timeSlotStr = `${hr.toString().padStart(2, '0')}:${mn.toString().padStart(2, '0')}`;
    
    slots.push({
      time: timeSlotStr,
      available: !bookedSlots.includes(timeSlotStr),
    });

    currentMins += duration + buffer;
  }

  return slots;
}

/**
 * @route   GET /api/appointments/slots
 * @desc    Get available timeslots for a doctor, branch on a date
 */
router.get('/slots', async (req, res) => {
  const { doctorId, branchId, date } = req.query;

  if (!doctorId || !branchId || !date) {
    return res.status(400).json({ error: 'Missing doctorId, branchId, or date.' });
  }

  try {
    const slots = await getAvailableSlotsForDate(doctorId as string, branchId as string, date as string);
    res.json({ slots });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error generating timeslots.' });
  }
});

/**
 * @route   POST /api/appointments
 * @desc    Book an online appointment
 */
router.post('/', async (req, res) => {
  const { date, timeSlot, type, patientId, doctorId, branchId } = req.body;

  if (!date || !timeSlot || !patientId || !doctorId || !branchId) {
    return res.status(400).json({ error: 'Missing required appointment parameters.' });
  }

  // Reject past dates
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (new Date(date) < today) {
    return res.status(400).json({ error: 'Cannot book appointments in the past.' });
  }

  try {
    // Check if slot is already taken
    const existing = await prisma.appointment.findUnique({
      where: {
        doctorId_branchId_date_timeSlot: {
          doctorId,
          branchId,
          date,
          timeSlot,
        },
      },
    });

    if (existing && existing.status === 'BOOKED') {
      return res.status(400).json({ error: 'This time slot is already booked.' });
    }

    const appointment = await prisma.appointment.create({
      data: {
        date,
        timeSlot,
        type: (type as VisitType) || 'NEW',
        status: 'BOOKED',
        patientId,
        doctorId,
        branchId,
      },
    });

    res.status(201).json({ appointment });
  } catch (err: any) {
    console.error('Book appointment error:', err);
    res.status(500).json({ error: 'Server error booking appointment.' });
  }
});

/**
 * @route   GET /api/appointments/:clinicId
 * @desc    Get appointments for a branch/doctor by date (receptionist schedule view)
 */
router.get('/:clinicId', async (req, res) => {
  const { branchId, doctorId, date } = req.query;

  if (!branchId || !date) {
    return res.status(400).json({ error: 'Branch ID and date query parameters are required.' });
  }

  try {
    const appointments = await prisma.appointment.findMany({
      where: {
        branchId: branchId as string,
        doctorId: doctorId ? (doctorId as string) : undefined,
        date: date as string,
      },
      include: {
        patient: {
          select: { id: true, name: true, phone: true, age: true, gender: true },
        },
        doctor: {
          include: {
            user: { select: { name: true } },
          },
        },
      },
      orderBy: { timeSlot: 'asc' },
    });

    res.json({ appointments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error retrieving appointments.' });
  }
});

/**
 * @route   PATCH /api/appointments/:id/cancel
 * @desc    Cancel a booked appointment
 */
router.patch('/:id/cancel', async (req, res) => {
  try {
    const appointment = await prisma.appointment.findUnique({ where: { id: req.params.id } });
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found.' });
    }
    if (appointment.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Appointment is already cancelled.' });
    }

    const updated = await prisma.appointment.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED' },
    });

    res.json({ message: 'Appointment cancelled.', appointment: updated });
  } catch (err) {
    console.error('Cancel appointment error:', err);
    res.status(500).json({ error: 'Server error cancelling appointment.' });
  }
});

/**
 * @route   POST /api/appointments/:id/checkin
 * @desc    Convert a booked appointment to an active queue token
 */
router.post('/:id/checkin', async (req, res) => {
  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id: req.params.id },
      include: {
        patient: { select: { id: true, name: true, phone: true } },
        doctor: { include: { user: { select: { name: true } } } },
      },
    });

    if (!appointment) return res.status(404).json({ error: 'Appointment not found.' });
    if (appointment.status === 'CANCELLED') return res.status(400).json({ error: 'Cannot check in a cancelled appointment.' });
    if (appointment.status === 'CHECKED_IN') return res.status(400).json({ error: 'This appointment is already checked in.' });

    // Count today's tokens for this doctor to generate the next token number
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const todayCount = await prisma.token.count({
      where: { doctorId: appointment.doctorId, branchId: appointment.branchId, checkInTime: { gte: startOfDay } },
    });

    const prefix = appointment.doctor.user.name.slice(0, 2).toUpperCase();
    const tokenNo = `${prefix}-${String(todayCount + 1).padStart(3, '0')}`;

    const waitingCount = await prisma.token.count({
      where: { branchId: appointment.branchId, doctorId: appointment.doctorId, status: 'WAITING' },
    });

    const branchData = await prisma.branch.findUnique({ where: { id: appointment.branchId }, select: { waitingSeats: true } });
    const seatedCount = await prisma.token.count({
      where: { branchId: appointment.branchId, status: 'WAITING', seatStatus: 'SEATED' },
    });
    const seatStatus = seatedCount < (branchData?.waitingSeats || 10) ? 'SEATED' : 'WAITING_OUTSIDE';

    const [token] = await prisma.$transaction([
      prisma.token.create({
        data: {
          tokenNo,
          queueOrder: waitingCount + 1,
          type: 'GENERAL',
          visitType: appointment.type,
          status: 'WAITING',
          patientId: appointment.patientId,
          patientName: appointment.patient.name,
          patientPhone: appointment.patient.phone || '',
          doctorId: appointment.doctorId,
          branchId: appointment.branchId,
          appointmentId: appointment.id,
          estimatedWait: (waitingCount + 1) * 15,
          seatStatus,
        },
      }),
      prisma.appointment.update({
        where: { id: appointment.id },
        data: { status: 'CHECKED_IN' },
      }),
    ]);

    const io = req.app.get('io');
    if (io) {
      const { recalculateQueueETAs } = require('../queue/queue.routes');
      await recalculateQueueETAs(appointment.branchId, appointment.doctorId, io);
    }

    res.status(201).json({ message: 'Patient checked in and added to queue.', token });
  } catch (err: any) {
    console.error('Appointment checkin error:', err);
    res.status(500).json({ error: 'Server error during appointment check-in.' });
  }
});

export default router;
