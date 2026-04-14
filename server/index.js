require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');

const prisma = new PrismaClient();
const app = express();

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// Rate limiting on API routes
app.use('/api/', apiLimiter);

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------
app.use('/api/auth', require('./routes/auth'));
app.use('/api/platform', require('./routes/platform'));
app.use('/api/tenants', require('./routes/tenants'));
app.use('/api/extensions', require('./routes/extensions'));
app.use('/api/phone-numbers', require('./routes/phoneNumbers'));
app.use('/api/ivr', require('./routes/ivr'));
app.use('/api/ring-groups', require('./routes/ringGroups'));
app.use('/api/call-queues', require('./routes/callQueues'));
app.use('/api/call-logs', require('./routes/callLogs'));
app.use('/api/voicemail', require('./routes/voicemail'));
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/time-conditions', require('./routes/timeConditions'));
app.use('/api/recordings', require('./routes/recordings'));
app.use('/api/branding', require('./routes/branding'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/usage-stats', require('./routes/usageStats'));

// Phone auto-provisioning (public endpoint for phones + admin endpoints)
app.use('/api/provisioning', require('./routes/provisioning'));

// SignalWire Webhooks (no auth — SignalWire calls these)
app.use('/api/webhooks/signalwire', require('./routes/webhooks'));

// ---------------------------------------------------------------------------
// Serve React client in production
// ---------------------------------------------------------------------------
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'error', message: 'Database unavailable' });
  }
});

// Error handler
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`WhiteLabel PBX server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

module.exports = app;
