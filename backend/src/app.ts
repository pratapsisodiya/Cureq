import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import swaggerDocs from './shared/config/swagger';
import { helmetMiddleware, rateLimiter, hppMiddleware } from './shared/middlewares/security.middleware';
import { errorHandler } from './shared/middlewares/error.middleware';
import Logger from './shared/utils/logger';

// Route Imports
import authRoutes from './features/auth/auth.routes';
import clinicRoutes from './features/clinic/clinic.routes';
import queueRoutes from './features/queue/queue.routes';
import appointmentRoutes from './features/appointment/appointment.routes';
import patientRoutes from './features/patient/patient.routes';
import analyticsRoutes from './features/analytics/analytics.routes';
import notificationRoutes from './features/notification/notification.routes';
import featuresRouter from './features/clinic-features/clinic-features.routes';
import aiRouter from './features/ai/ai.routes';
import billingRouter from './features/billing/billing.routes';
import chatbotRouter from './features/chatbot/chatbot.routes';
import prescriptionRouter from './features/prescription/prescription.routes';

// Socket setup
import { setupQueueSockets } from './features/queue/queue.socket';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Configure Socket.IO server
const io = new Server(server, {
  cors: {
    origin: '*', // Allow connections from frontend pages
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

// Expose Socket.IO client pool to routing handlers
app.set('io', io);

// Security Middlewares
app.use(helmetMiddleware);
app.use(rateLimiter);
app.use(hppMiddleware);

// Middlewares
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Request logging middleware
const morganMiddleware = morgan(
  ':method :url :status :res[content-length] - :response-time ms',
  {
    stream: {
      write: (message) => Logger.http(message.trim()),
    },
  }
);
app.use(morganMiddleware);

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Register REST Routes
app.use('/api/auth', authRoutes);
app.use('/api/clinics', clinicRoutes);
app.use('/api/queues', queueRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/features', featuresRouter);
app.use('/api/ai', aiRouter);
app.use('/api/billing', billingRouter);
app.use('/api/chatbot', chatbotRouter);
app.use('/api/prescriptions', prescriptionRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'CureQ API', time: new Date() });
});

// Configure websocket event handlers
setupQueueSockets(io);

// Global error handler — must be registered after all routes
app.use(errorHandler);

export { app, server, io };
