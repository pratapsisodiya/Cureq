import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient, Role, SubscriptionPlan } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../../shared/middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'cureq_super_secret_jwt_key_123!';

// Helper to sign token
const generateToken = (user: any) => {
  return jwt.sign(
    { id: user.id, email: user.email, phone: user.phone, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

/**
 * @route   POST /api/auth/register
 * @desc    Register a new Clinic Admin
 */
router.post('/register', async (req, res) => {
  const { email, password, name, phone } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Please provide email, password, and name.' });
  }

  try {
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { phone: phone || undefined }] },
    });

    if (existingUser) {
      if (password && existingUser.password) {
        const isMatch = await bcrypt.compare(password, existingUser.password);
        if (isMatch) {
          const token = generateToken(existingUser);
          return res.status(200).json({ token, user: { id: existingUser.id, email: existingUser.email, role: existingUser.role, name: existingUser.name } });
        }
      }
      return res.status(400).json({ error: 'User with this email or phone already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        phone,
        role: 'CLINIC_ADMIN',
      },
    });

    const token = generateToken(user);
    res.status(201).json({ token, user: { id: user.id, email: user.email, role: user.role, name: user.name } });
  } catch (err: any) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

/**
 * @route   POST /api/auth/clerk-sync
 * @desc    Sync user authenticated via Clerk with database (auto-register if new)
 */
router.post('/clerk-sync', async (req, res) => {
  const { email, name, phone, role } = req.body;

  if (!email || !name) {
    return res.status(400).json({ error: 'Please provide email and name.' });
  }

  try {
    // 1. Try to find user by email
    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // 2. If user doesn't exist, create a new one (as CLINIC_ADMIN by default)
      user = await prisma.user.create({
        data: {
          email,
          name,
          phone: phone || null,
          role: role || 'CLINIC_ADMIN',
        },
      });
    } else {
      // If user exists, optionally update phone and name if empty
      const dataToUpdate: any = {};
      if (!user.name && name) dataToUpdate.name = name;
      if (!user.phone && phone) dataToUpdate.phone = phone;
      
      if (Object.keys(dataToUpdate).length > 0) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: dataToUpdate,
        });
      }
    }

    // 3. Generate token
    const token = generateToken(user);
    res.status(200).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      },
    });
  } catch (err: any) {
    console.error('Clerk sync error:', err);
    res.status(500).json({ error: 'Server error during Clerk auth sync.' });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Login for Clinic Admin, Doctor, or Super Admin
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Please provide email and password.' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      return res.status(400).json({ error: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials.' });
    }

    const token = generateToken(user);
    res.json({ token, user: { id: user.id, email: user.email, role: user.role, name: user.name } });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

/**
 * @route   POST /api/auth/patient-login
 * @desc    Google/OTP phone login for patients (auto-register if new)
 */
router.post('/patient-login', async (req, res) => {
  const { phone, name, age, gender } = req.body;

  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required.' });
  }

  try {
    let user = await prisma.user.findUnique({ where: { phone } });

    if (!user) {
      // Create new Patient
      user = await prisma.user.create({
        data: {
          phone,
          name: name || `Patient ${phone.slice(-4)}`,
          role: 'PATIENT',
          age: age ? parseInt(age) : null,
          gender: gender || null,
        },
      });
    } else if (name || age || gender) {
      // Update patient profile details if provided
      user = await prisma.user.update({
        where: { phone },
        data: {
          name: name || user.name,
          age: age ? parseInt(age) : user.age,
          gender: gender || user.gender,
        },
      });
    }

    const token = generateToken(user);
    res.json({ token, user: { id: user.id, phone: user.phone, role: user.role, name: user.name } });
  } catch (err: any) {
    console.error('Patient login error:', err);
    res.status(500).json({ error: 'Server error during patient auth.' });
  }
});

/**
 * @route   POST /api/auth/onboard
 * @desc    Multi-step Clinic Onboarding
 */
router.post('/onboard', authenticateToken, async (req: AuthRequest, res) => {
  const adminId = req.user?.id;
  const { clinicName, speciality, doctors } = req.body;

  if (!adminId) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  if (!clinicName || !speciality || !doctors || !Array.isArray(doctors)) {
    return res.status(400).json({ error: 'Missing clinic details or doctor configurations.' });
  }

  try {
    // 1. Check if admin already has a clinic
    const existingClinic = await prisma.clinic.findUnique({ where: { adminId } });
    if (existingClinic) {
      const branch = await prisma.branch.findFirst({ where: { clinicId: existingClinic.id } });
      return res.status(200).json({
        message: 'Clinic and doctors onboarded successfully!',
        clinic: existingClinic,
        branch: branch,
      });
    }

    // Run creation inside a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 2. Create the Clinic
      const clinic = await tx.clinic.create({
        data: {
          name: clinicName,
          speciality,
          adminId,
          plan: 'FREE', // Start on Free Tier
        },
      });

      // 3. Create the Main Branch
      const branch = await tx.branch.create({
        data: {
          name: `${clinicName} - Main Branch`,
          address: 'Default Branch Address',
          phone: req.user?.phone || '123-456-7890',
          clinicId: clinic.id,
        },
      });

      // 4. Create each doctor
      for (const doc of doctors) {
        const email = doc.email?.trim() || null;
        const phone = doc.phone?.trim() || null;

        if (!email && !phone) {
          throw new Error(`Doctor "${doc.name || 'unnamed'}" must have an email or contact number.`);
        }

        let doctorUser = null;
        const orConditions = [];
        if (email) orConditions.push({ email });
        if (phone) orConditions.push({ phone });

        if (orConditions.length > 0) {
          doctorUser = await tx.user.findFirst({
            where: { OR: orConditions },
          });
        }

        if (!doctorUser) {
          const hashedPassword = await bcrypt.hash(doc.password || 'CureQDoctor123!', 10);
          doctorUser = await tx.user.create({
            data: {
              email,
              phone,
              password: hashedPassword,
              name: doc.name || 'Unnamed Doctor',
              role: 'DOCTOR',
            },
          });
        } else {
          // If user exists, upgrade to DOCTOR role
          doctorUser = await tx.user.update({
            where: { id: doctorUser.id },
            data: { role: 'DOCTOR' },
          });
        }

        // Create DoctorProfile if not exists
        let doctorProfile = await tx.doctorProfile.findUnique({
          where: { userId: doctorUser.id }
        });

        if (!doctorProfile) {
          doctorProfile = await tx.doctorProfile.create({
            data: {
              userId: doctorUser.id,
              speciality: doc.speciality || speciality,
              bio: doc.bio || `Consulting Doctor at ${clinicName}`,
            },
          });
        }

        // Add schedules for this doctor if not exists
        if (doc.schedules && Array.isArray(doc.schedules)) {
          for (const sched of doc.schedules) {
            const dayOfWeek = parseInt(sched.dayOfWeek);
            const existingSched = await tx.doctorSchedule.findUnique({
              where: {
                doctorId_branchId_dayOfWeek: {
                  doctorId: doctorProfile.id,
                  branchId: branch.id,
                  dayOfWeek,
                }
              }
            });

            if (!existingSched) {
              await tx.doctorSchedule.create({
                data: {
                  doctorId: doctorProfile.id,
                  branchId: branch.id,
                  dayOfWeek,
                  startTime: sched.startTime || '09:00',
                  endTime: sched.endTime || '17:00',
                  slotDuration: parseInt(sched.slotDuration) || 15,
                  maxPatients: parseInt(sched.maxPatients) || 30,
                  bufferTime: parseInt(sched.bufferTime) || 5,
                },
              });
            }
          }
        }
      }

      return { clinic, branch };
    }, {
      maxWait: 5000,
      timeout: 20000,
    });

    res.status(201).json({
      message: 'Clinic and doctors onboarded successfully!',
      clinic: result.clinic,
      branch: result.branch,
    });
  } catch (err: any) {
    console.error('Onboarding failure:', err);
    res.status(500).json({ error: err.message || 'Server error during clinic onboarding.' });
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current user session
 */
router.get('/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user?.id },
      include: {
        clinicAdmin: {
          include: {
            branches: true,
          },
        },
        doctorProfile: {
          include: {
            schedules: {
              include: {
                branch: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json({ user });
  } catch (err: any) {
    console.error('Fetch me error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

/**
 * @route   POST /api/auth/check-email
 * @desc    Check if an email exists (for password reset flow)
 */
router.post('/check-email', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'No account found with this email address.' });
    }
    res.json({ message: 'Email found.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password for an existing account
 */
router.post('/reset-password', async (req, res) => {
  const { email, newPassword } = req.body;
  if (!email || !newPassword) {
    return res.status(400).json({ error: 'Email and new password are required.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'No account found with this email.' });
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { email }, data: { password: hashedPassword } });
    res.json({ message: 'Password reset successfully.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Server error resetting password.' });
  }
});

export default router;
