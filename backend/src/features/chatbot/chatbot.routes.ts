import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { authenticateToken, requireRole, AuthRequest } from '../../shared/middleware/auth.middleware';
import { runChatbotTurn, checkRateLimit } from './chatbot.service';

const router = Router();
const prisma = new PrismaClient();

const DEFAULT_CONFIG = {
  botName: 'CureQ Assistant',
  greeting: 'Hello! 👋 How can I help you today? I can check queue status, book appointments, or answer your clinic questions.',
  primaryColor: '#01696f',
  language: 'auto',
  faqPairs: [],
  enableQueueStatus: true,
  enableBooking: true,
  enableTriage: true,
  enablePrescriptionHistory: false,
  widgetPosition: 'bottom-right',
  isActive: true,
};

/**
 * POST /api/chatbot/:clinicId/message  — PUBLIC (patients) or staff with JWT
 */
router.post('/:clinicId/message', async (req: AuthRequest, res) => {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many messages. Please wait a moment.', reply: 'You\'re sending messages too quickly. Please wait a moment and try again.' });
  }

  const { clinicId } = req.params;
  const { message, sessionId, branchId } = req.body;

  if (!message?.trim()) return res.status(400).json({ error: 'Message is required.' });

  // Determine role from optional JWT
  let userRole: 'patient' | 'staff' = 'patient';
  const authHeader = req.headers['authorization'];
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const secret = process.env.JWT_SECRET || 'cureq_super_secret_jwt_key_123!';
      const decoded = jwt.verify(authHeader.split(' ')[1], secret) as any;
      if (['DOCTOR', 'CLINIC_ADMIN'].includes(decoded.role)) userRole = 'staff';
    } catch { /* treat as patient */ }
  }

  try {
    // Validate clinic exists
    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic) return res.status(404).json({ error: 'Clinic not found.', reply: 'This clinic could not be found. Please check the link and try again.' });

    // Load or create chat session
    let session;
    if (sessionId) {
      session = await prisma.chatSession.findFirst({ where: { id: sessionId, clinicId } });
    }
    if (!session) {
      session = await prisma.chatSession.create({ data: { clinicId, userRole, metadata: { branchId } } });
    }

    // Load or auto-create bot config
    let config = await prisma.chatBotConfig.findUnique({ where: { clinicId } });
    if (!config) {
      config = await prisma.chatBotConfig.create({ data: { clinicId, ...DEFAULT_CONFIG } });
    }

    if (!config.isActive) {
      return res.json({ reply: 'The chatbot is currently disabled for this clinic. Please contact the reception desk.', sessionId: session.id, toolsUsed: [] });
    }

    const { reply, toolsUsed } = await runChatbotTurn({
      clinicId,
      sessionId: session.id,
      userMessage: message.trim(),
      userRole,
      config,
    });

    // Update session timestamp
    await prisma.chatSession.update({ where: { id: session.id }, data: { updatedAt: new Date() } });

    res.json({ reply, sessionId: session.id, toolsUsed });
  } catch (err) {
    console.error('Chatbot route error:', err);
    res.status(500).json({
      error: 'Chatbot service error.',
      reply: "I'm having trouble right now. Please call the clinic directly or ask at the reception desk.",
      sessionId,
    });
  }
});

/**
 * GET /api/chatbot/:clinicId/config  — PUBLIC (widget fetches on init)
 */
router.get('/:clinicId/config', async (req, res) => {
  const { clinicId } = req.params;
  try {
    let config = await prisma.chatBotConfig.findUnique({ where: { clinicId } });
    if (!config) {
      config = await prisma.chatBotConfig.create({ data: { clinicId, ...DEFAULT_CONFIG } });
    }
    // Return only fields the widget needs — omit systemPromptExt and full faqPairs
    res.json({
      botName: config.botName,
      greeting: config.greeting,
      primaryColor: config.primaryColor,
      language: config.language,
      isActive: config.isActive,
      widgetPosition: config.widgetPosition,
      enableTriage: config.enableTriage,
      enableBooking: config.enableBooking,
    });
  } catch (err) {
    console.error('Config fetch error:', err);
    res.status(500).json({ error: 'Failed to load chatbot config.' });
  }
});

/**
 * GET /api/chatbot/:clinicId/config/full  — AUTHENTICATED (configurator page)
 */
router.get('/:clinicId/config/full', authenticateToken, requireRole(['CLINIC_ADMIN']), async (req: AuthRequest, res) => {
  const { clinicId } = req.params;
  try {
    let config = await prisma.chatBotConfig.findUnique({ where: { clinicId } });
    if (!config) {
      config = await prisma.chatBotConfig.create({ data: { clinicId, ...DEFAULT_CONFIG } });
    }
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load config.' });
  }
});

/**
 * PUT /api/chatbot/:clinicId/config  — AUTHENTICATED (clinic admin only)
 */
router.put('/:clinicId/config', authenticateToken, requireRole(['CLINIC_ADMIN']), async (req: AuthRequest, res) => {
  const { clinicId } = req.params;
  const { botName, greeting, systemPromptExt, primaryColor, language, faqPairs, enableTriage, enableBooking, enablePrescriptionHistory, enableQueueStatus, widgetPosition, isActive } = req.body;
  try {
    const updated = await prisma.chatBotConfig.upsert({
      where: { clinicId },
      create: { clinicId, botName, greeting, systemPromptExt, primaryColor, language, faqPairs: faqPairs || [], enableTriage, enableBooking, enablePrescriptionHistory, enableQueueStatus, widgetPosition, isActive },
      update: { botName, greeting, systemPromptExt, primaryColor, language, faqPairs: faqPairs || [], enableTriage, enableBooking, enablePrescriptionHistory, enableQueueStatus, widgetPosition, isActive, updatedAt: new Date() },
    });
    res.json({ config: updated });
  } catch (err) {
    console.error('Config update error:', err);
    res.status(500).json({ error: 'Failed to update chatbot config.' });
  }
});

/**
 * GET /api/chatbot/:clinicId/sessions  — AUTHENTICATED (view history)
 */
router.get('/:clinicId/sessions', authenticateToken, requireRole(['CLINIC_ADMIN', 'DOCTOR']), async (req: AuthRequest, res) => {
  const { clinicId } = req.params;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = 20;
  const { phone, date } = req.query;

  try {
    const where: any = { clinicId };
    if (phone) where.patientPhone = { contains: phone as string };
    if (date) {
      const dayStart = new Date(`${date}T00:00:00.000Z`);
      const dayEnd = new Date(`${date}T23:59:59.999Z`);
      where.createdAt = { gte: dayStart, lte: dayEnd };
    }

    const [sessions, total] = await Promise.all([
      prisma.chatSession.findMany({
        where,
        include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.chatSession.count({ where }),
    ]);

    res.json({ sessions, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('Sessions fetch error:', err);
    res.status(500).json({ error: 'Failed to load chat sessions.' });
  }
});

/**
 * GET /api/chatbot/session/:sessionId/messages  — AUTHENTICATED
 */
router.get('/session/:sessionId/messages', authenticateToken, requireRole(['CLINIC_ADMIN', 'DOCTOR']), async (req: AuthRequest, res) => {
  const { sessionId } = req.params;
  try {
    const messages = await prisma.chatMessage.findMany({
      where: { sessionId, role: { in: ['user', 'assistant'] } },
      orderBy: { createdAt: 'asc' },
    });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load messages.' });
  }
});

export default router;
