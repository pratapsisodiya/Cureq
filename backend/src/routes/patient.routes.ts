import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

/**
 * @route   GET /api/patients/:phone
 * @desc    Receptionist patient search by phone (lookup for fast walk-in check-in)
 */
router.get('/:phone', authenticateToken, async (req, res) => {
  try {
    const patient = await prisma.user.findFirst({
      where: {
        phone: req.params.phone,
        role: 'PATIENT',
      },
      select: {
        id: true,
        name: true,
        phone: true,
        age: true,
        gender: true,
        bloodGroup: true,
      },
    });

    if (!patient) {
      return res.status(404).json({ message: 'No patient found with this phone number.' });
    }

    res.json({ patient });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error looking up patient.' });
  }
});

/**
 * @route   GET /api/patients/id/:patientId/history
 * @desc    Get patient history logs (past visits, chief complaints, notes)
 */
router.get('/id/:patientId/history', authenticateToken, async (req, res) => {
  try {
    const history = await prisma.visitLog.findMany({
      where: { patientId: req.params.patientId },
      orderBy: { date: 'desc' },
    });

    res.json({ history });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error retrieving visit logs.' });
  }
});

/**
 * @route   PUT /api/patients/token/:tokenId/notes
 * @desc    Doctor adds notes/prescriptions to a token consultation card
 */
router.put('/token/:tokenId/notes', authenticateToken, async (req, res) => {
  const { notes } = req.body;

  try {
    const token = await prisma.token.update({
      where: { id: req.params.tokenId },
      data: { notes },
    });

    res.json({ message: 'Consultation notes updated successfully.', token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error saving notes.' });
  }
});

export default router;
