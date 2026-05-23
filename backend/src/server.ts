import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

// Route Imports
import authRoutes from './routes/auth.routes';
import clinicRoutes from './routes/clinic.routes';
import queueRoutes from './routes/queue.routes';
import appointmentRoutes from './routes/appointment.routes';
import patientRoutes from './routes/patient.routes';
import analyticsRoutes from './routes/analytics.routes';
import notificationRoutes from './routes/notification.routes';

// Socket setup
import { setupQueueSockets } from './sockets/queue.socket';

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
app.use(cors({ origin: '*', credentials: true }));
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
