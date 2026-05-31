import { PrismaClient } from '@prisma/client';
import { aiService } from '../ai/ai.service';

const prisma = new PrismaClient();

// ─── Azure OpenAI Config ────────────────────────────────────────────────────

const AZURE_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT || '';
const AZURE_KEY = process.env.AZURE_OPENAI_API_KEY || '';
const AZURE_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2024-12-01-preview';
const AZURE_DEPLOY = process.env.AZURE_DEPLOYMENT_NAME || 'gpt-4.1-mini';

const AZURE_CHAT_URL = `${AZURE_ENDPOINT}openai/deployments/${AZURE_DEPLOY}/chat/completions?api-version=${AZURE_VERSION}`;

async function azureChat(body: object): Promise<any> {
  if (!AZURE_KEY) throw new Error('AZURE_OPENAI_API_KEY not configured');
  const response = await fetch(AZURE_CHAT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': AZURE_KEY },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Azure OpenAI ${response.status}: ${err}`);
  }
  return response.json();
}

// ─── Simple In-Memory Rate Limiter ─────────────────────────────────────────

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(ip: string, max = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}

// ─── Tool Definitions ───────────────────────────────────────────────────────

const CHATBOT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_queue_status',
      description: 'Get live queue count and estimated wait time for a clinic branch or specific doctor.',
      parameters: {
        type: 'object',
        properties: {
          branchId: { type: 'string', description: 'Branch UUID from clinic info' },
          doctorId: { type: 'string', description: 'DoctorProfile UUID (optional, omit for branch-wide summary)' },
        },
        required: ['branchId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_patient_token',
      description: "Find a patient's current queue token and position by phone number.",
      parameters: {
        type: 'object',
        properties: {
          patientPhone: { type: 'string', description: '10-digit phone number' },
          branchId: { type: 'string' },
        },
        required: ['patientPhone', 'branchId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'book_appointment',
      description: 'Book a new appointment for a patient with a doctor.',
      parameters: {
        type: 'object',
        properties: {
          patientName: { type: 'string' },
          phone: { type: 'string', description: '10-digit phone number' },
          doctorId: { type: 'string' },
          branchId: { type: 'string' },
          date: { type: 'string', description: 'YYYY-MM-DD format' },
          timeSlot: { type: 'string', description: 'HH:MM format e.g. 10:30' },
        },
        required: ['patientName', 'phone', 'doctorId', 'branchId', 'date', 'timeSlot'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_clinic_info',
      description: 'Get clinic name, address, phone, specialities, and list of available doctors.',
      parameters: {
        type: 'object',
        properties: {
          clinicId: { type: 'string' },
        },
        required: ['clinicId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_available_slots',
      description: 'Get available appointment time slots for a doctor on a given date.',
      parameters: {
        type: 'object',
        properties: {
          doctorId: { type: 'string' },
          branchId: { type: 'string' },
          date: { type: 'string', description: 'YYYY-MM-DD' },
        },
        required: ['doctorId', 'branchId', 'date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_prescription_history',
      description: "Get a patient's last visit summary and prescription history. Use only when patient requests their own records.",
      parameters: {
        type: 'object',
        properties: {
          patientPhone: { type: 'string' },
          clinicId: { type: 'string' },
        },
        required: ['patientPhone', 'clinicId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'triage_symptoms',
      description: 'Assess urgency of patient symptoms and recommend appropriate care level and speciality.',
      parameters: {
        type: 'object',
        properties: {
          chiefComplaint: { type: 'string', description: "Patient's described symptoms or reason for visit" },
        },
        required: ['chiefComplaint'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_appointment',
      description: "Cancel a patient's booked appointment. Requires appointment ID and patient phone for verification.",
      parameters: {
        type: 'object',
        properties: {
          appointmentId: { type: 'string' },
          patientPhone: { type: 'string' },
        },
        required: ['appointmentId', 'patientPhone'],
      },
    },
  },
];

// ─── Tool Executors ─────────────────────────────────────────────────────────

async function tool_get_queue_status({ branchId, doctorId }: { branchId: string; doctorId?: string }) {
  const where: any = { branchId, status: { in: ['WAITING', 'IN_CONSULTATION'] } };
  if (doctorId) where.doctorId = doctorId;

  const [waitingCount, inConsult] = await Promise.all([
    prisma.token.count({ where }),
    prisma.token.findFirst({
      where: { ...where, status: 'IN_CONSULTATION' },
      select: { tokenNo: true, doctor: { include: { user: { select: { name: true } } } } },
    }),
  ]);

  const eta = doctorId
    ? await aiService.getEstimatedWaitTime(branchId, doctorId, waitingCount)
    : waitingCount * 15;

  return {
    waitingCount,
    currentlyServing: inConsult ? `${inConsult.tokenNo} (Dr. ${inConsult.doctor.user.name})` : 'None',
    estimatedWaitMinutes: eta,
  };
}

async function tool_get_patient_token({ patientPhone, branchId }: { patientPhone: string; branchId: string }) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const token = await prisma.token.findFirst({
    where: { patientPhone, branchId, createdAt: { gte: todayStart }, status: { in: ['WAITING', 'IN_CONSULTATION'] } },
    include: { doctor: { include: { user: { select: { name: true } } } } },
    orderBy: { createdAt: 'desc' },
  });

  if (!token) return { found: false, message: 'No active token found for this phone number today.' };

  const ahead = await prisma.token.count({
    where: { branchId, doctorId: token.doctorId, status: 'WAITING', queueOrder: { lt: token.queueOrder } },
  });

  return {
    found: true,
    tokenNo: token.tokenNo,
    status: token.status,
    doctorName: token.doctor.user.name,
    patientsAhead: ahead,
    estimatedWaitMinutes: token.estimatedWait,
    seatStatus: token.seatStatus,
  };
}

async function tool_book_appointment(args: {
  patientName: string; phone: string; doctorId: string;
  branchId: string; date: string; timeSlot: string;
}) {
  // Find or create patient user
  let patient = await prisma.user.findFirst({ where: { phone: args.phone, role: 'PATIENT' } });
  if (!patient) {
    patient = await prisma.user.create({ data: { name: args.patientName, phone: args.phone, role: 'PATIENT' } });
  }

  // Check slot availability
  const existing = await prisma.appointment.findUnique({
    where: { doctorId_branchId_date_timeSlot: { doctorId: args.doctorId, branchId: args.branchId, date: args.date, timeSlot: args.timeSlot } },
  });
  if (existing && existing.status === 'BOOKED') {
    return { success: false, message: `The slot at ${args.timeSlot} on ${args.date} is already booked. Please choose another time.` };
  }

  const appt = await prisma.appointment.create({
    data: {
      date: args.date, timeSlot: args.timeSlot, type: 'NEW', status: 'BOOKED',
      patientId: patient.id, doctorId: args.doctorId, branchId: args.branchId,
    },
  });

  return { success: true, appointmentId: appt.id, date: args.date, timeSlot: args.timeSlot, message: `Appointment confirmed for ${args.date} at ${args.timeSlot}.` };
}

async function tool_get_clinic_info({ clinicId }: { clinicId: string }) {
  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    include: {
      branches: {
        take: 1,
        include: {
          schedules: {
            where: { active: true },
            include: { doctor: { include: { user: { select: { name: true } } } } },
            distinct: ['doctorId'],
          },
        },
      },
    },
  });
  if (!clinic) return { found: false };

  const branch = clinic.branches[0];
  const doctors = branch?.schedules.map(s => ({
    id: s.doctorId,
    name: s.doctor.user.name,
    speciality: s.doctor.speciality,
    branchId: branch.id,
  })) || [];

  return {
    clinicName: clinic.name,
    specialities: clinic.speciality,
    branch: branch ? { id: branch.id, name: branch.name, address: branch.address, phone: branch.phone } : null,
    doctors,
  };
}

async function tool_get_available_slots({ doctorId, branchId, date }: { doctorId: string; branchId: string; date: string }) {
  const dayOfWeek = new Date(date + 'T12:00:00').getDay();
  const schedule = await prisma.doctorSchedule.findFirst({
    where: { doctorId, branchId, dayOfWeek, active: true },
  });

  if (!schedule) return { available: false, message: `Doctor is not scheduled on this day.` };

  // Generate slots
  const slots: string[] = [];
  const [startH, startM] = schedule.startTime.split(':').map(Number);
  const [endH, endM] = schedule.endTime.split(':').map(Number);
  const startTotal = startH * 60 + startM;
  const endTotal = endH * 60 + endM;
  const step = schedule.slotDuration + schedule.bufferTime;

  for (let t = startTotal; t + schedule.slotDuration <= endTotal; t += step) {
    const h = Math.floor(t / 60).toString().padStart(2, '0');
    const m = (t % 60).toString().padStart(2, '0');
    slots.push(`${h}:${m}`);
  }

  // Remove already booked slots
  const booked = await prisma.appointment.findMany({
    where: { doctorId, branchId, date, status: 'BOOKED' },
    select: { timeSlot: true },
  });
  const bookedSet = new Set(booked.map(b => b.timeSlot));
  const available = slots.filter(s => !bookedSet.has(s));

  return { date, available, totalSlots: slots.length, bookedCount: bookedSet.size };
}

async function tool_get_prescription_history({ patientPhone, clinicId }: { patientPhone: string; clinicId: string }) {
  return aiService.getPatientContextBrief(patientPhone, clinicId);
}

async function tool_cancel_appointment({ appointmentId, patientPhone }: { appointmentId: string; patientPhone: string }) {
  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { patient: { select: { phone: true } } },
  });

  if (!appt) return { success: false, message: 'Appointment not found.' };
  if (appt.patient.phone !== patientPhone) return { success: false, message: 'Phone number does not match appointment records.' };
  if (appt.status === 'CANCELLED') return { success: false, message: 'Appointment is already cancelled.' };

  await prisma.appointment.update({ where: { id: appointmentId }, data: { status: 'CANCELLED' } });
  return { success: true, message: `Appointment on ${appt.date} at ${appt.timeSlot} has been cancelled.` };
}

async function executeTool(name: string, args: any, clinicId: string): Promise<any> {
  switch (name) {
    case 'get_queue_status':         return tool_get_queue_status(args);
    case 'get_patient_token':        return tool_get_patient_token(args);
    case 'book_appointment':         return tool_book_appointment(args);
    case 'get_clinic_info':          return tool_get_clinic_info({ clinicId });
    case 'get_available_slots':      return tool_get_available_slots(args);
    case 'get_prescription_history': return tool_get_prescription_history({ ...args, clinicId });
    case 'triage_symptoms':          return aiService.triagePatient(args.chiefComplaint);
    case 'cancel_appointment':       return tool_cancel_appointment(args);
    default: throw new Error(`Unknown tool: ${name}`);
  }
}

// ─── System Prompt Builder ──────────────────────────────────────────────────

function buildSystemPrompt(config: any, clinic: any, userRole: 'patient' | 'staff'): string {
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const branch = clinic?.branches?.[0];

  const faqBlock = Array.isArray(config.faqPairs) && config.faqPairs.length > 0
    ? config.faqPairs.map((f: any) => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n')
    : 'No FAQs configured.';

  const capabilities: string[] = [];
  if (config.enableQueueStatus) capabilities.push('- Check live queue status and wait times');
  if (config.enableBooking) capabilities.push('- Book and cancel appointments');
  if (config.enableTriage) capabilities.push('- Assess symptom urgency and recommend care level');
  if (config.enablePrescriptionHistory) capabilities.push('- Look up past visit notes and prescriptions (patient verification required)');

  return `You are ${config.botName}, the AI assistant for ${clinic?.name || 'this clinic'}.
Today is ${today}.

CLINIC INFORMATION:
- Name: ${clinic?.name || 'Not specified'}
- Specialities: ${clinic?.speciality || 'General'}
- Address: ${branch?.address || 'Not specified'}
- Phone: ${branch?.phone || 'Not specified'}

YOUR ROLE:
${userRole === 'staff'
    ? 'You are assisting clinic staff (doctor or receptionist). You may access queue summaries, patient history, and operational information.'
    : 'You are assisting a patient or visitor. Keep responses warm, simple, and non-technical. Never share one patient\'s details with another user.'}

LANGUAGE:
${config.language === 'auto'
    ? 'Detect the language of each user message and respond in the same language. If they mix languages, respond similarly.'
    : `Always respond in: ${config.language}`}

YOUR CAPABILITIES:
${capabilities.length > 0 ? capabilities.join('\n') : '- General clinic information queries'}

IMPORTANT RULES:
1. NEVER prescribe medications or suggest dosages. You may advise urgency and recommend seeing a doctor.
2. For EMERGENCY symptoms (chest pain, unconsciousness, severe bleeding, stroke) — immediately advise calling emergency services (112 in India).
3. NEVER share one patient's personal details with another session.
4. Always recommend in-person consultation for diagnosis. Your triage is guidance only.
5. If you cannot answer something, politely suggest calling the clinic directly at ${branch?.phone || 'the clinic number'}.
6. Use tools to get real-time data. Do NOT fabricate queue counts, appointment slots, or patient information.

CLINIC FAQ:
${faqBlock}
${config.systemPromptExt ? `\nADDITIONAL CLINIC INSTRUCTIONS:\n${config.systemPromptExt}` : ''}`.trim();
}

// ─── Heuristic Fallback (when Azure is unavailable) ─────────────────────────

function heuristicFallback(message: string, config: any): string {
  const lower = message.toLowerCase();
  const faq = Array.isArray(config.faqPairs) ? config.faqPairs : [];

  // Check FAQ matches (with word boundary protection for short keywords)
  for (const pair of faq) {
    if (pair.question) {
      const q = pair.question.toLowerCase().trim();
      const slice = q.slice(0, 15);
      if (lower.includes(slice)) {
        // If the matching term is very short (e.g. "fee"), ensure it's not matched inside another word (e.g. "coffee")
        if (slice.length < 5) {
          const regex = new RegExp(`\\b${slice}\\b`, 'i');
          if (regex.test(lower)) return pair.answer;
        } else {
          return pair.answer;
        }
      }
    }
  }

  if (/wait|queue|token|how long|कितनी देर|कब/i.test(message))
    return `I'm currently unable to check the live queue, but you can ask at the reception desk for your wait time estimate.`;
  if (/appointment|book|schedule|appoint|अपॉइंटमेंट/i.test(message))
    return `To book an appointment, please call the clinic directly or visit the reception. I'm temporarily unable to process bookings.`;
  if (/emergency|urgent|chest pain|unconscious|bleeding|seizure/i.test(message))
    return `🚨 This sounds urgent. Please call emergency services (112) immediately or go to the nearest emergency room. Do not wait.`;
  if (/location|address|where|कहाँ/i.test(message))
    return `Please contact the clinic directly for address and directions. I'm unable to retrieve that information right now.`;
  if (/timing|hours|open|close|time|समय/i.test(message))
    return `Please call the clinic to confirm current operating hours. I'm temporarily offline.`;

  return `I'm having a bit of trouble right now. Please call the clinic directly or ask at the reception desk. I'll be back shortly!`;
}

// ─── Main Chat Turn ─────────────────────────────────────────────────────────

export async function runChatbotTurn(params: {
  clinicId: string;
  sessionId: string;
  userMessage: string;
  userRole: 'patient' | 'staff';
  config: any;
}): Promise<{ reply: string; toolsUsed: string[] }> {
  const { clinicId, sessionId, userMessage, userRole, config } = params;

  // Persist user message
  await prisma.chatMessage.create({ data: { sessionId, role: 'user', content: userMessage } });

  // If Azure not configured, use heuristic fallback immediately
  if (!AZURE_KEY || !AZURE_ENDPOINT) {
    const reply = heuristicFallback(userMessage, config);
    await prisma.chatMessage.create({ data: { sessionId, role: 'assistant', content: reply } });
    return { reply, toolsUsed: [] };
  }

  // Load session history (last 20 messages)
  const history = await prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' },
    take: 20,
  });

  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    include: { branches: { take: 1 } },
  });

  const systemPrompt = buildSystemPrompt(config, clinic, userRole);

  // Build messages array — reconstruct tool call sequences correctly
  const messages: any[] = [{ role: 'system', content: systemPrompt }];

  for (const m of history) {
    if (m.role === 'tool') {
      messages.push({ role: 'tool', tool_call_id: m.toolCallId, content: JSON.stringify(m.toolResult) });
    } else if (m.role === 'assistant' && m.toolCallId && m.toolName) {
      messages.push({
        role: 'assistant',
        content: m.content || null,
        tool_calls: [{ id: m.toolCallId, type: 'function', function: { name: m.toolName, arguments: JSON.stringify(m.toolArgs || {}) } }],
      });
    } else {
      messages.push({ role: m.role, content: m.content });
    }
  }

  const toolsUsed: string[] = [];
  const MAX_ROUNDS = 5;

  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const azureResponse = await azureChat({
        messages,
        tools: CHATBOT_TOOLS,
        tool_choice: 'auto',
        temperature: 0.4,
        max_tokens: 800,
      });

      const choice = azureResponse.choices?.[0];
      if (!choice) throw new Error('No response from Azure OpenAI');

      const assistantMsg = choice.message;

      // Model wants to call tools
      if (choice.finish_reason === 'tool_calls' && assistantMsg.tool_calls?.length) {
        messages.push(assistantMsg);

        for (const toolCall of assistantMsg.tool_calls) {
          const toolName = toolCall.function.name;
          let toolArgs = {};
          try {
            toolArgs = JSON.parse(toolCall.function.arguments || '{}');
          } catch (e) {
            console.error('Failed to parse tool arguments from LLM response:', e, toolCall.function.arguments);
          }
          toolsUsed.push(toolName);

          let toolResult: any;
          try {
            toolResult = await executeTool(toolName, toolArgs, clinicId);
          } catch (err) {
            toolResult = { error: 'Tool execution failed', details: String(err) };
          }

          messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(toolResult) });

          // Persist tool call
          await prisma.chatMessage.create({
            data: { sessionId, role: 'assistant', content: '', toolCallId: toolCall.id, toolName, toolArgs },
          });
          await prisma.chatMessage.create({
            data: { sessionId, role: 'tool', content: JSON.stringify(toolResult), toolCallId: toolCall.id, toolName, toolResult },
          });
        }
        continue;
      }

      // Final text response
      const reply = assistantMsg.content || "I'm sorry, I couldn't generate a response. Please try again.";
      await prisma.chatMessage.create({ data: { sessionId, role: 'assistant', content: reply } });
      return { reply, toolsUsed };
    }

    // MAX_ROUNDS exceeded
    const fallback = "I wasn't able to complete your request. Please call the clinic directly for assistance.";
    await prisma.chatMessage.create({ data: { sessionId, role: 'assistant', content: fallback } });
    return { reply: fallback, toolsUsed };
  } catch (err) {
    console.error('Azure chatbot error, using heuristic fallback:', err);
    const reply = heuristicFallback(userMessage, config);
    await prisma.chatMessage.create({ data: { sessionId, role: 'assistant', content: reply } });
    return { reply, toolsUsed };
  }
}
