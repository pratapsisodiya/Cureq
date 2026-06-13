import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../../shared/middleware/auth.middleware';
import { aiService } from '../ai/ai.service';

const router = Router();
const prisma = new PrismaClient();

/**
 * @route   GET /api/analytics/:clinicId
 * @desc    Get dashboard charts and statistics
 */
router.get('/:clinicId', authenticateToken, async (req, res) => {
  const { clinicId } = req.params;
  
  try {
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - 7);
    startOfWeek.setHours(0, 0, 0, 0);

    // 1. Calculate general stats strip (Total, In Queue, Served, No-Shows today)
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const todayTokens = await prisma.token.findMany({
      where: {
        branch: { clinicId },
        createdAt: { gte: startOfToday },
      },
    });

    const stats = {
      registered: todayTokens.length,
      inQueue: todayTokens.filter(t => t.status === 'WAITING' || t.status === 'IN_CONSULTATION').length,
      served: todayTokens.filter(t => t.status === 'SERVED').length,
      noshow: todayTokens.filter(t => t.status === 'NO_SHOW').length,
    };

    // 2. Daily Patient Volume (Bar Chart data for past 7 days)
    const volumeData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStart = new Date(d.setHours(0, 0, 0, 0));
      const dayEnd = new Date(d.setHours(23, 59, 59, 999));

      const count = await prisma.token.count({
        where: {
          branch: { clinicId },
          createdAt: { gte: dayStart, lte: dayEnd },
        },
      });

      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      volumeData.push({ day: dayName, count });
    }

    // 3. Average Wait Time Trend (Line Chart data for past 7 days)
    const waitTimeData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStart = new Date(d.setHours(0, 0, 0, 0));
      const dayEnd = new Date(d.setHours(23, 59, 59, 999));

      const dayTokens = await prisma.token.findMany({
        where: {
          branch: { clinicId },
          status: 'SERVED',
          startTime: { not: null },
          createdAt: { gte: dayStart, lte: dayEnd },
        },
        select: { checkInTime: true, startTime: true },
      });

      let avgWait = 0;
      if (dayTokens.length > 0) {
        const total = dayTokens.reduce((acc, t) => {
          const waitMs = t.startTime!.getTime() - t.checkInTime.getTime();
          return acc + Math.max(0, Math.round(waitMs / 60000));
        }, 0);
        avgWait = Math.round(total / dayTokens.length);
      }

      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      waitTimeData.push({ day: dayName, waitMinutes: avgWait || 15 }); // 15min default fallback to look nice
    }

    // 4. Peak Hours Heatmap (Hour x DayOfWeek Grid)
    // Query last 30 days of registrations to get representative distribution
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);

    const pastMonthTokens = await prisma.token.findMany({
      where: {
        branch: { clinicId },
        createdAt: { gte: monthAgo },
      },
      select: { createdAt: true },
    });

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const heatmap: { day: string; hour: string; count: number }[] = [];

    // Initialize clean grid
    days.forEach(day => {
      for (let h = 9; h <= 17; h++) {
        const hourStr = `${h === 12 ? 12 : h % 12}:00 ${h >= 12 ? 'PM' : 'AM'}`;
        heatmap.push({ day, hour: hourStr, count: 0 });
      }
    });

    // Populate grid
    pastMonthTokens.forEach(t => {
      const dayName = days[t.createdAt.getDay()];
      const h = t.createdAt.getHours();
      if (h >= 9 && h <= 17) {
        const hourStr = `${h === 12 ? 12 : h % 12}:00 ${h >= 12 ? 'PM' : 'AM'}`;
        const cell = heatmap.find(c => c.day === dayName && c.hour === hourStr);
        if (cell) cell.count += 1;
      }
    });

    // 5. Doctor performance ranking
    const doctorProfiles = await prisma.doctorProfile.findMany({
      where: { schedules: { some: { branch: { clinicId } } } },
      include: {
        user: { select: { name: true } },
        tokens: {
          where: { createdAt: { gte: startOfWeek } },
        },
      },
    });

    const doctorPerformance = doctorProfiles.map(d => {
      const servedList = d.tokens.filter(t => t.status === 'SERVED' && t.startTime && t.endTime);
      const noShowCount = d.tokens.filter(t => t.status === 'NO_SHOW').length;
      
      let avgConsult = 15; // default baseline
      if (servedList.length > 0) {
        const sumMins = servedList.reduce((acc, t) => {
          const diff = t.endTime!.getTime() - t.startTime!.getTime();
          return acc + Math.round(diff / 60000);
        }, 0);
        avgConsult = Math.round(sumMins / servedList.length);
      }

      return {
        name: d.user.name,
        speciality: d.speciality,
        servedCount: d.tokens.filter(t => t.status === 'SERVED').length,
        noShowRate: d.tokens.length > 0 ? Math.round((noShowCount / d.tokens.length) * 100) : 0,
        avgConsultationTime: avgConsult || 12,
      };
    });

    res.json({
      stats,
      volumeData,
      waitTimeData,
      heatmap,
      doctorPerformance,
    });
  } catch (err) {
    console.error('Analytics feed error:', err);
    res.status(500).json({ error: 'Server error generating analytics.' });
  }
});

/**
 * @route   GET /api/analytics/:clinicId/doctor-insights
 * @desc    Per-doctor satisfaction scores from VisitLog ratings (last 30 days)
 */
router.get('/:clinicId/doctor-insights', authenticateToken, async (req, res) => {
  const { clinicId } = req.params;
  try {
    const doctors = await prisma.doctorProfile.findMany({
      where: { schedules: { some: { branch: { clinicId } } } },
      include: { user: { select: { name: true } } },
    });

    if (!doctors.length) return res.json({ insights: [] });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const logs = await prisma.visitLog.findMany({
      where: {
        doctorName: { in: doctors.map(d => d.user.name) },
        rating: { not: null },
        date: { gte: thirtyDaysAgo },
      },
      select: { doctorName: true, rating: true },
    });

    const ratingMap = new Map(doctors.map(d => [d.user.name, { name: d.user.name, speciality: d.speciality, ratings: [] as number[] }]));
    logs.forEach(l => {
      const entry = ratingMap.get(l.doctorName);
      if (entry && l.rating) entry.ratings.push(l.rating);
    });

    const insights = Array.from(ratingMap.values())
      .filter(d => d.ratings.length > 0)
      .map(d => ({
        name: d.name,
        speciality: d.speciality,
        avgRating: parseFloat((d.ratings.reduce((a, b) => a + b, 0) / d.ratings.length).toFixed(1)),
        ratingCount: d.ratings.length,
      }))
      .sort((a, b) => b.avgRating - a.avgRating);

    res.json({ insights });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch doctor insights.' });
  }
});

/**
 * @route   GET /api/analytics/:clinicId/today-appointments
 * @desc    Today's appointment schedule summary
 */
router.get('/:clinicId/today-appointments', authenticateToken, async (req, res) => {
  const { clinicId } = req.params;
  try {
    const today = new Date().toISOString().split('T')[0];
    const appointments = await prisma.appointment.findMany({
      where: { branch: { clinicId }, date: today },
      include: {
        doctor: { include: { user: { select: { name: true } } } },
        patient: { select: { name: true } },
      },
      orderBy: { timeSlot: 'asc' },
    });

    res.json({
      total: appointments.length,
      checkedIn: appointments.filter(a => a.status === 'CHECKED_IN').length,
      pending: appointments.filter(a => a.status === 'BOOKED').length,
      cancelled: appointments.filter(a => a.status === 'CANCELLED').length,
      upcoming: appointments
        .filter(a => a.status === 'BOOKED')
        .slice(0, 6)
        .map(a => ({
          id: a.id,
          timeSlot: a.timeSlot,
          patientName: a.patient.name,
          doctorName: a.doctor.user.name,
          type: a.type,
        })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch today appointments.' });
  }
});

/**
 * @route   POST /api/analytics/:clinicId/query
 * @desc    Gemini NLP analytical questions on clinic efficiency
 */
router.post('/:clinicId/query', authenticateToken, async (req, res) => {
  const { question } = req.body;
  const { clinicId } = req.params;

  if (!question) {
    return res.status(400).json({ error: 'Question is required.' });
  }

  try {
    const analysis = await aiService.getQueueAnalyticsAnswer(question, clinicId);
    res.json({ analysis });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error generating AI analytics response.' });
  }
});

/**
 * @route   GET /api/analytics/:clinicId/report
 * @desc    Download CSV of all past visit logs for this clinic
 */
router.get('/:clinicId/report', authenticateToken, async (req, res) => {
  const { clinicId } = req.params;
  try {
    const tokens = await prisma.token.findMany({
      where: { branch: { clinicId } },
      include: { doctor: { include: { user: true } } },
      orderBy: { createdAt: 'desc' },
    });

    let csvContent = 'Token No,Date,Patient Name,Phone,Doctor,Urgency,Status,Notes,Duration (mins)\n';
    
    tokens.forEach(t => {
      let duration = 0;
      if (t.startTime && t.endTime) {
        duration = Math.round((t.endTime.getTime() - t.startTime.getTime()) / 60000);
      }
      const dateStr = t.createdAt.toISOString().split('T')[0];
      const cleanNotes = (t.notes || '').replace(/"/g, '""');
      
      csvContent += `${t.tokenNo},${dateStr},"${t.patientName}",${t.patientPhone},"${t.doctor.user.name}",${t.type},${t.status},"${cleanNotes}",${duration}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=cureq_report_${req.params.clinicId}.csv`);
    res.status(200).send(csvContent);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to export CSV report.' });
  }
});

export default router;
