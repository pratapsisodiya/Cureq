import { vi, beforeEach, afterEach } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';
import { PrismaClient } from '@prisma/client';

process.env.JWT_SECRET = 'test_secret_for_cureq_platform';

export const prismaMock = mockDeep<PrismaClient>();

vi.mock('@prisma/client', () => {
  return {
    PrismaClient: vi.fn().mockImplementation(function() {
      return prismaMock;
    }),
    Role: {
      SUPER_ADMIN: 'SUPER_ADMIN',
      CLINIC_ADMIN: 'CLINIC_ADMIN',
      DOCTOR: 'DOCTOR',
      PATIENT: 'PATIENT',
    },
    TokenStatus: {
      WAITING: 'WAITING',
      IN_CONSULTATION: 'IN_CONSULTATION',
      SERVED: 'SERVED',
      SKIPPED: 'SKIPPED',
      NO_SHOW: 'NO_SHOW',
    },
    SeatStatus: {
      SEATED: 'SEATED',
      WAITING_OUTSIDE: 'WAITING_OUTSIDE',
    },
    TokenType: {
      GENERAL: 'GENERAL',
      PRIORITY: 'PRIORITY',
      EMERGENCY: 'EMERGENCY',
    },
    VisitType: {
      NEW: 'NEW',
      FOLLOW_UP: 'FOLLOW_UP',
      EMERGENCY: 'EMERGENCY',
    },
    AppointmentStatus: {
      BOOKED: 'BOOKED',
      CHECKED_IN: 'CHECKED_IN',
      CANCELLED: 'CANCELLED',
    },
    SubscriptionPlan: {
      FREE: 'FREE',
      STARTER: 'STARTER',
      PRO: 'PRO',
      CHAIN: 'CHAIN',
    },
    NotificationChannel: {
      SMS: 'SMS',
      WHATSAPP: 'WHATSAPP',
    },
  };
});

beforeEach(() => {
  mockReset(prismaMock);
});

afterEach(() => {
  vi.restoreAllMocks();
});
