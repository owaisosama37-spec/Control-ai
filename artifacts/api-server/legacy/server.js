import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Routes
import projectRoutes from './routes/projects.js';
import taskRoutes from './routes/tasks.js';
import authRoutes from './routes/auth.js';
import analyticsRoutes from './routes/analytics.js';
import auditRoutes from './routes/audit.js';
import settingsRoutes from './routes/settings.js';
import webhookRoutes from './routes/webhooks.js';

// Middleware
import { errorHandler } from './middleware/errorHandler.js';
import { authMiddleware } from './middleware/auth.js';
import { loggingMiddleware } from './middleware/logging.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
  }
});

// Global Variables
let systemState = {
  mode: 'manual', // manual or autonomous
  claude_status: 'online',
  replit_status: 'online',
  gemini_status: 'online',
  emergency_stop: false,
  last_update: new Date()
};

// Security Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Logging
app.use(loggingMiddleware);

// Database Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/starfruit-control-room')
  .then(() => console.log('✓ MongoDB connected'))
  .catch(err => console.error('✗ MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', authMiddleware, projectRoutes);
app.use('/api/tasks', authMiddleware, taskRoutes);
app.use('/api/analytics', authMiddleware, analyticsRoutes);
app.use('/api/audit', authMiddleware, auditRoutes);
app.use('/api/settings', authMiddleware, settingsRoutes);
app.use('/api/webhooks', webhookRoutes);

// System Status Endpoints
app.get('/api/system/status', (req, res) => {
  res.json({
    status: 'ok',
    mode: systemState.mode,
    agents: {
      claude: systemState.claude_status,
      replit: systemState.replit_status,
      gemini: systemState.gemini_status
    },
    emergency_stop: systemState.emergency_stop,
    timestamp: new Date()
  });
});

// Sleep Mode Toggle
app.post('/api/system/sleep-mode', authMiddleware, (req, res) => {
  const { enabled } = req.body;
  systemState.mode = enabled ? 'autonomous' : 'manual';

  io.emit('system:mode-changed', {
    mode: systemState.mode,
    timestamp: new Date()
  });

  res.json({
    success: true,
    mode: systemState.mode,
    message: enabled ? 'Autonomous mode enabled' : 'Manual mode enabled'
  });
});

// Emergency Stop
app.post('/api/system/emergency-stop', authMiddleware, async (req, res) => {
  systemState.emergency_stop = true;
  systemState.mode = 'manual';

  // Broadcast to all clients
  io.emit('system:emergency-stop', {
    timestamp: new Date(),
    initiated_by: req.user.id
  });

  // Log the action
  console.error('🚨 EMERGENCY STOP ACTIVATED');

  res.json({
    success: true,
    message: 'Emergency stop activated'
  });
});

// Real-time WebSocket Connection
io.on('connection', (socket) => {
  console.log(`✓ Client connected: ${socket.id}`);

  // Send current system state
  socket.emit('system:state', systemState);

  // Handle task updates
  socket.on('task:update', async (data) => {
    io.emit('task:updated', data);
  });

  // Handle queue events
  socket.on('queue:reorder', (data) => {
    io.emit('queue:reordered', data);
  });

  socket.on('disconnect', () => {
    console.log(`✗ Client disconnected: ${socket.id}`);
  });
});

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error Handler
app.use(errorHandler);

// Start Server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`\n🎛️  Control Room Dashboard Server started on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
  console.log(`📚 API Docs: http://localhost:${PORT}/api/docs\n`);
});

export { app, io, systemState };
