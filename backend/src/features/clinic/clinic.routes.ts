import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireRole } from '../../shared/middleware/auth.middleware';
import { createAuditLog } from '../clinic-features/clinic-features.routes';

const router = Router();
const prisma = new PrismaClient();

/**
 * Helper to enforce SaaS Plan Limits
 */
export async function verifyPlanLimits(
  clinicId: string,
  limitType: 'doctors' | 'branches' | 'tokens'
): Promise<{ allowed: boolean; message?: string }> {
  try {
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      include: {
        branches: {
          include: {
            schedules: {
              select: { doctorId: true }
            }
          }
        }
      }
    });

    if (!clinic) {
      return { allowed: false, message: 'Clinic not found' };
    }

    const plan = clinic.plan;

    if (limitType === 'branches') {
      const branchCount = clinic.branches.length;
      if (plan !== 'CHAIN' && branchCount >= 1) {
        return {
          allowed: false,
          message: `Your current plan (${plan}) only supports 1 clinic branch. Upgrade to Chain plan for multi-branch support.`
        };
      }
    }

    if (limitType === 'doctors') {
      // Count unique doctorIds across all branches of the clinic
      const doctorIds = new Set<string>();
      clinic.branches.forEach(b => {
        b.schedules.forEach(s => doctorIds.add(s.doctorId));
      });
      const doctorCount = doctorIds.size;

      if (plan === 'FREE' && doctorCount >= 1) {
        return {
          allowed: false,
          message: 'Free plan is limited to 1 Doctor profile. Upgrade to Starter or Pro to add more doctors.'
        };
      }
      if (plan === 'STARTER' && doctorCount >= 3) {
        return {
          allowed: false,
          message: 'Starter plan is limited to 3 Doctors. Upgrade to Pro or Chain for unlimited doctors.'
        };
      }
    }

    return { allowed: true };
  } catch (err) {
    console.error('Plan limits check error:', err);
    return { allowed: false, message: 'Failed to verify subscription limits.' };
  }
}

/**
 * @route   GET /api/clinics/:id
 * @desc    Get clinic details with branches, doctors, and schedules
 */
router.get('/:id', async (req, res) => {
  try {
    const clinic = await prisma.clinic.findUnique({
      where: { id: req.params.id },
      include: {
        branches: {
          include: {
            schedules: {
              include: {
                doctor: {
                  include: {
                    user: {
                      select: { id: true, name: true, phone: true, email: true }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!clinic) {
      return res.status(404).json({ error: 'Clinic not found.' });
    }

    res.json({ clinic });
  } catch (err) {
    console.error('Fetch clinic error:', err);
    res.status(500).json({ error: 'Server error fetching clinic details.' });
  }
});

/**
 * @route   POST /api/clinics/:id/branches
 * @desc    Create a new Branch in a Clinic (gated by SaaS plans)
 */
router.post('/:id/branches', authenticateToken, requireRole(['CLINIC_ADMIN']), async (req, res) => {
  const { name, address, phone } = req.body;
  const clinicId = req.params.id;

  if (!name || !address || !phone) {
    return res.status(400).json({ error: 'Please provide branch name, address, and contact phone.' });
  }

  try {
    // Check if the current user owns this clinic
    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic || clinic.adminId !== (req as any).user.id) {
      return res.status(403).json({ error: 'Forbidden. You do not own this clinic.' });
    }

    // Verify multi-branch chain limits
    const limitCheck = await verifyPlanLimits(clinicId, 'branches');
    if (!limitCheck.allowed) {
      return res.status(402).json({ error: limitCheck.message });
    }

    const branch = await prisma.branch.create({
      data: {
        name,
        address,
        phone,
        clinicId,
      },
    });

    await createAuditLog(clinicId, 'BRANCH_CREATED', `New branch "${name}" added at ${address}`);

    res.status(201).json({ branch });
  } catch (err) {
    console.error('Create branch error:', err);
    res.status(500).json({ error: 'Server error creating branch.' });
  }
});

/**
 * @route   PUT /api/clinics/:id/profile
 * @desc    Update clinic name and speciality
 */
router.put('/:id/profile', authenticateToken, requireRole(['CLINIC_ADMIN']), async (req, res) => {
  const { name, speciality } = req.body;
  const clinicId = req.params.id;

  if (!name) {
    return res.status(400).json({ error: 'Clinic name is required.' });
  }

  try {
    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic || clinic.adminId !== (req as any).user.id) {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    const updated = await prisma.clinic.update({
      where: { id: clinicId },
      data: { name, speciality: speciality || clinic.speciality },
    });

    res.json({ clinic: updated });
  } catch (err) {
    console.error('Update clinic profile error:', err);
    res.status(500).json({ error: 'Server error updating clinic profile.' });
  }
});

/**
 * @route   PUT /api/clinics/:id/plan
 * @desc    Upgrade / Modify Clinic Billing Plan (Mock checkout gateway)
 */
router.put('/:id/plan', authenticateToken, requireRole(['CLINIC_ADMIN']), async (req, res) => {
  const { plan } = req.body; // FREE, STARTER, PRO, CHAIN
  const clinicId = req.params.id;

  if (!['FREE', 'STARTER', 'PRO', 'CHAIN'].includes(plan)) {
    return res.status(400).json({ error: 'Invalid subscription plan.' });
  }

  try {
    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic || clinic.adminId !== (req as any).user.id) {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    const updated = await prisma.clinic.update({
      where: { id: clinicId },
      data: { plan },
    });

    res.json({ message: `Successfully updated plan to ${plan}`, clinic: updated });
  } catch (err) {
    console.error('Update plan error:', err);
    res.status(500).json({ error: 'Server error updating plan.' });
  }
});

/**
 * @route   PUT /api/clinics/:id/branches/:branchId/seats
 * @desc    Update waiting room seats capacity (waitingSeats)
 */
router.put('/:id/branches/:branchId/seats', authenticateToken, requireRole(['CLINIC_ADMIN']), async (req, res) => {
  const { waitingSeats } = req.body;
  const { id: clinicId, branchId } = req.params;

  if (waitingSeats === undefined || typeof waitingSeats !== 'number' || waitingSeats < 0) {
    return res.status(400).json({ error: 'Invalid waiting room seats value.' });
  }

  try {
    // Check if the current user owns this clinic
    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic || clinic.adminId !== (req as any).user.id) {
      return res.status(403).json({ error: 'Forbidden. You do not own this clinic.' });
    }

    const branch = await prisma.branch.update({
      where: { id: branchId },
      data: { waitingSeats },
    });

    // Run promotion logic to fill any newly available seats
    const io = req.app.get('io');
    const { promoteWaitingOutsidePatients } = require('../queue/queue.routes');
    await promoteWaitingOutsidePatients(branchId, io);

    res.json({ message: 'Waiting room seats updated successfully.', branch });
  } catch (err) {
    console.error('Update branch seats error:', err);
    res.status(500).json({ error: 'Server error updating seats capacity.' });
  }
});

/**
 * @route   POST /api/clinics/:id/doctors
 * @desc    Add a new doctor to the clinic (creates User + DoctorProfile + DoctorSchedule)
 */
router.post('/:id/doctors', authenticateToken, requireRole(['CLINIC_ADMIN']), async (req, res) => {
  const { name, email, password, phone, speciality, branchId, schedules } = req.body;
  const clinicId = req.params.id;

  if (!name || !email || !password || !speciality || !branchId) {
    return res.status(400).json({ error: 'Name, email, password, speciality, and branchId are required.' });
  }

  try {
    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic || clinic.adminId !== (req as any).user.id) {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    const limitCheck = await verifyPlanLimits(clinicId, 'doctors');
    if (!limitCheck.allowed) {
      return res.status(402).json({ error: limitCheck.message });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'A user with this email already exists.' });
    }

    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone: phone || null,
        password: hashedPassword,
        role: 'DOCTOR',
      },
    });

    const doctorProfile = await prisma.doctorProfile.create({
      data: { userId: user.id, speciality },
    });

    if (schedules && Array.isArray(schedules) && schedules.length > 0) {
      await prisma.doctorSchedule.createMany({
        data: schedules.map((s: any) => ({
          doctorId: doctorProfile.id,
          branchId,
          dayOfWeek: parseInt(s.dayOfWeek),
          startTime: s.startTime || '09:00',
          endTime: s.endTime || '17:00',
          slotDuration: parseInt(s.slotDuration) || 15,
          maxPatients: parseInt(s.maxPatients) || 30,
          bufferTime: parseInt(s.bufferTime) || 5,
          active: true,
        })),
        skipDuplicates: true,
      });
    }

    await createAuditLog(clinicId, 'DOCTOR_ADDED', `Dr. ${name} (${speciality}) added to clinic`);

    res.status(201).json({ message: 'Doctor added successfully.', doctorId: doctorProfile.id, userId: user.id });
  } catch (err: any) {
    console.error('Add doctor error:', err);
    res.status(500).json({ error: 'Server error adding doctor.' });
  }
});

/**
 * @route   PUT /api/clinics/:id/doctors/:doctorId/schedule
 * @desc    Upsert doctor schedule for a branch
 */
router.put('/:id/doctors/:doctorId/schedule', authenticateToken, requireRole(['CLINIC_ADMIN']), async (req, res) => {
  const { branchId, schedules } = req.body;
  const clinicId = req.params.id;
  const { doctorId } = req.params;

  if (!branchId || !schedules || !Array.isArray(schedules)) {
    return res.status(400).json({ error: 'branchId and schedules array are required.' });
  }

  try {
    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic || clinic.adminId !== (req as any).user.id) {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    for (const s of schedules) {
      await prisma.doctorSchedule.upsert({
        where: {
          doctorId_branchId_dayOfWeek: {
            doctorId,
            branchId,
            dayOfWeek: parseInt(s.dayOfWeek),
          },
        },
        update: {
          startTime: s.startTime,
          endTime: s.endTime,
          slotDuration: parseInt(s.slotDuration) || 15,
          maxPatients: parseInt(s.maxPatients) || 30,
          bufferTime: parseInt(s.bufferTime) || 5,
          active: s.active !== false,
        },
        create: {
          doctorId,
          branchId,
          dayOfWeek: parseInt(s.dayOfWeek),
          startTime: s.startTime,
          endTime: s.endTime,
          slotDuration: parseInt(s.slotDuration) || 15,
          maxPatients: parseInt(s.maxPatients) || 30,
          bufferTime: parseInt(s.bufferTime) || 5,
          active: s.active !== false,
        },
      });
    }

    res.json({ message: 'Doctor schedule updated successfully.' });
  } catch (err: any) {
    console.error('Update schedule error:', err);
    res.status(500).json({ error: 'Server error updating schedule.' });
  }
});

export default router;
