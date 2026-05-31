import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

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

// Middlewares
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'CureQ API', time: new Date() });
});

// Configure websocket event handlers
setupQueueSockets(io);

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 CureQ server running in ${process.env.NODE_ENV || 'development'} mode on http://localhost:${PORT}`);
});
