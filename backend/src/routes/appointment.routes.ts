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

export default router;
